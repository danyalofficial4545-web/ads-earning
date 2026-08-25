import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  adSessions,
  ads,
  appSettings,
  aviatorBets,
  aviatorRounds,
  authChallenges,
  broadcasts,
  deposits,
  gameDailyStats,
  gameRounds,
  gameTaskClaims,
  gameTasks,
  gameWalletTransactions,
  packages,
  paymentAccounts,
  profiles,
  supportTickets,
  transactions,
  userPackages,
  users,
  withdrawals,
} from "../drizzle/schema";
import {
  ADMIN_EMAIL,
  ensurePlatformData,
  ensureProfile,
  getActivePackageForUser,
  getDb,
  getDayKey,
  getSettings,
  isDesignatedAdmin,
} from "./db";
import { clientIpFromHeaders, createHumanChallenge, hashSecurityValue, matchesHumanChallenge } from "./security";
import { sendTelegramAlert } from "./telegram";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  createLocalSession,
  hashPassword,
  LOCAL_SESSION_COOKIE,
  verifyPassword,
} from "./localAuth";
import {
  AD_REWARD_PKR,
  AD_TIMER_MESSAGE,
  applyWithdrawalRequest,
  canUseMemberWorkspace,
  fromPkr,
  getAdClaimStatus,
  isValidPakistanMobileNumber,
  referralLimitCredit,
  refundRejectedWithdrawal,
  toPkr,
  validateDepositAmountPkr,
  validateWithdrawalRequest,
  WHATSAPP_JOIN_REWARD_PKR,
  WITHDRAWAL_ACCOUNT_NAME_MESSAGE,
  WITHDRAWAL_MINIMUM_MESSAGE,
  WITHDRAWAL_MIN_PKR,
  WITHDRAWAL_NO_PACKAGE_MESSAGE,
  WITHDRAWAL_WALLET_NUMBER_MESSAGE,
  WITHDRAWAL_WALLET_TYPE_MESSAGE,
} from "./rules";
import {
  getDailyAdQuota,
  getDailyAdStates,
  getNextPakistanMidnight,
} from "../shared/adRules";
import {
  cappedAviatorPayout,
  chooseGenericGameOutcome,
  chooseCrashMultiplierX100,
  createMiningState,
  crashTimeFor,
  EURO_GENERIC_GAME_KEYS,
  maxDailyGameProfit,
  miningMultiplierX100,
  multiplierAt,
  parseCrashBandWeights,
  validateGenericGameSelection,
  validateEuroBetAmount,
} from "./euroRules";

function fail(message: string, code: TRPCError["code"] = "BAD_REQUEST"): never {
  throw new TRPCError({ code, message });
}

function publicUser(user: typeof users.$inferSelect) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { ...safeUser, hasPassword: Boolean(_passwordHash) };
}

async function getActor(ctx: { user: NonNullable<unknown> }) {
  const user = ctx.user as typeof users.$inferSelect;
  const profile = await ensureProfile(user);
  if (!canUseMemberWorkspace(profile.isBlocked))
    fail(
      "Your account is currently restricted. Please contact support.",
      "FORBIDDEN"
    );
  return { user, profile };
}

async function getAdmin(ctx: { user: NonNullable<unknown> }) {
  const actor = await getActor(ctx);
  if (!isDesignatedAdmin(actor.user, actor.profile))
    fail("Administrator access is restricted.", "FORBIDDEN");
  return actor;
}

function validateInlineUpload(
  raw: string,
  options: { label: string; maxBytes: number; acceptedType: (contentType: string) => boolean }
) {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) fail(`Please upload a valid ${options.label} file.`);
  const [, contentType, base64] = match;
  if (!options.acceptedType(contentType))
    fail(`Please upload a valid ${options.label} file.`);
  const normalizedBase64 = base64.replace(/\s/g, "");
  const file = Buffer.from(normalizedBase64, "base64");
  if (file.length === 0 || file.length > options.maxBytes)
    fail(`${options.label} must be between 1 byte and ${Math.floor(options.maxBytes / 1024 / 1024)} MB.`);
  return `data:${contentType};base64,${normalizedBase64}`;
}

function validateDirectBrandLogo(raw: string) {
  const value = raw.trim();
  const dataUrl = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (dataUrl) {
    const [, contentType, encodedData] = dataUrl;
    const base64 = encodedData.replace(/\s/g, "");
    const file = Buffer.from(base64, "base64");
    if (file.length === 0 || file.length > 1 * 1024 * 1024)
      fail("Logo image must be between 1 byte and 1 MB.");
    return `data:${contentType};base64,${base64}`;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      fail("Logo URL must use HTTP or HTTPS.");
    return url.toString();
  } catch {
    fail("Please upload a valid image or provide a valid logo URL.");
  }
}

function saveAdMedia(
  raw: string,
  contentType: "image" | "video"
) {
  return validateInlineUpload(raw, {
    label: contentType === "image" ? "image" : "video",
    maxBytes: 5 * 1024 * 1024,
    acceptedType: mimeType => mimeType.startsWith(`${contentType}/`),
  });
}

async function consumeHumanChallenge(
  db: any,
  input: {
    challengeId: string;
    challengeAnswer: string;
    deviceId: string;
    purpose: "sign_in" | "sign_up";
  }
) {
  const deviceFingerprintHash = hashSecurityValue(input.deviceId);
  const challenge = (
    await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, input.challengeId))
      .limit(1)
  )[0];
  if (
    !challenge ||
    challenge.purpose !== input.purpose ||
    challenge.deviceFingerprintHash !== deviceFingerprintHash ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() < Date.now() ||
    !matchesHumanChallenge(input.challengeAnswer, challenge.answerHash)
  )
    fail(
      "Human verification failed. Please solve the new check and try again.",
      "FORBIDDEN"
    );
  await db
    .update(authChallenges)
    .set({ consumedAt: new Date() })
    .where(eq(authChallenges.id, challenge.id));
  return deviceFingerprintHash;
}

async function buildOverview(userId: number) {
  const db = await getDb();
  if (!db)
    fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
  const settings = await getSettings();
  const profile = (
    await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  )[0];
  if (!profile) fail("Profile was not found.", "NOT_FOUND");
  const activePackage = await getActivePackageForUser(userId);
  const hasPendingChannelReward =
    profile.whatsappRewardEligible &&
    profile.whatsappBonusClaimed &&
    !profile.whatsappRewardWithdrawn;
  const dayKey = getDayKey();
  const watchedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(adSessions)
    .where(
      and(
        eq(adSessions.userId, userId),
        eq(adSessions.dayKey, dayKey),
        sql`${adSessions.claimedAt} IS NOT NULL`
      )
    );
  const totalEarned = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amountPkr}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "ad_reward"),
        eq(transactions.direction, "credit")
      )
    );
  const daysRemaining = activePackage
    ? Math.max(
        0,
        Math.ceil(
          (activePackage.ownership.expiresAt.getTime() - Date.now()) /
            86_400_000
        )
      )
    : 0;
  const activeAdRows = await db
    .select({ id: ads.id })
    .from(ads)
    .where(eq(ads.isActive, true))
    .orderBy(ads.id);
  const dailyQuota = activePackage
    ? getDailyAdQuota(activePackage.plan.pricePkr)
    : 0;
  const visibleProfile = activePackage || hasPendingChannelReward
    ? profile
    : { ...profile, balancePkr: 0, withdrawalLimitPkr: 0 };
  return {
    profile: visibleProfile,
    settings,
    activePackage: activePackage
      ? {
          ...activePackage.plan,
          ownershipId: activePackage.ownership.id,
          expiresAt: activePackage.ownership.expiresAt,
          daysRemaining,
        }
      : null,
    todayAds: {
      watched: Number(watchedRows[0]?.count ?? 0),
      total: Math.min(dailyQuota, activeAdRows.length),
      resetAt: getNextPakistanMidnight(),
    },
    totalEarnedPkr: Number(totalEarned[0]?.total ?? 0),
  };
}

async function getGameDailyStat(db: any, userId: number, dayKey: string) {
  return (
    await db
      .select()
      .from(gameDailyStats)
      .where(
        and(
          eq(gameDailyStats.userId, userId),
          eq(gameDailyStats.dayKey, dayKey)
        )
      )
      .limit(1)
  )[0];
}

async function updateGameDailyStat(
  db: any,
  input: { userId: number; profitPkr?: number; lossPkr?: number }
) {
  const dayKey = getDayKey();
  const current = await getGameDailyStat(db, input.userId, dayKey);
  const profitPkr = (current?.profitPkr ?? 0) + (input.profitPkr ?? 0);
  const lossPkr = (current?.lossPkr ?? 0) + (input.lossPkr ?? 0);
  if (current) {
    await db
      .update(gameDailyStats)
      .set({ profitPkr, lossPkr })
      .where(eq(gameDailyStats.id, current.id));
  } else {
    await db
      .insert(gameDailyStats)
      .values({ userId: input.userId, dayKey, profitPkr, lossPkr });
  }
  return { dayKey, profitPkr, lossPkr };
}

async function settleExpiredAviatorRound(db: any, userId: number, now = new Date()) {
  const activeRound = (
    await db
      .select()
      .from(aviatorRounds)
      .where(
        and(
          eq(aviatorRounds.userId, userId),
          eq(aviatorRounds.status, "active")
        )
      )
      .orderBy(desc(aviatorRounds.createdAt))
      .limit(1)
  )[0];
  if (!activeRound || activeRound.crashesAt.getTime() > now.getTime())
    return activeRound ?? null;

  const unsettledBets = await db
    .select()
    .from(aviatorBets)
    .where(
      and(
        eq(aviatorBets.roundId, activeRound.id),
        eq(aviatorBets.status, "active")
      )
    );
  if (unsettledBets.length) {
    await db
      .update(aviatorBets)
      .set({ status: "lost", settledAt: now })
      .where(
        and(
          eq(aviatorBets.roundId, activeRound.id),
          eq(aviatorBets.status, "active")
        )
      );
    await updateGameDailyStat(db, {
      userId,
      lossPkr: unsettledBets.reduce((total: number, bet: any) => total + bet.stakePkr, 0),
    });
  }
  await db
    .update(aviatorRounds)
    .set({ status: "crashed" })
    .where(eq(aviatorRounds.id, activeRound.id));
  return { ...activeRound, status: "crashed" as const };
}

function publicAviatorRound(round: typeof aviatorRounds.$inferSelect | null) {
  if (!round) return null;
  return {
    id: round.id,
    startsAt: round.startsAt,
    crashesAt: round.crashesAt,
    status: round.status,
    crashMultiplierX100:
      round.status === "crashed" ? round.crashMultiplierX100 : undefined,
  };
}

const EURO_GAME_LABELS: Record<(typeof EURO_GENERIC_GAME_KEYS)[number], string> = {
  slots: "Slots",
  mining: "Mining",
  ludo: "Ludo Dice",
  wheel: "Wheel",
  plinko: "Plinko",
  color: "Color Prediction",
  lucky: "Lucky Number",
};

function parseEuroState(raw: string | null) {
  if (!raw) return {} as Record<string, any>;
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {} as Record<string, any>;
  }
}

function publicGenericGameRound(round: typeof gameRounds.$inferSelect | null) {
  if (!round) return null;
  return {
    id: round.id,
    gameKey: round.gameKey,
    stakePkr: round.stakePkr,
    selection: round.selection,
    publicState: parseEuroState(round.publicState),
    multiplierX100: round.multiplierX100,
    payoutPkr: round.payoutPkr,
    status: round.status,
    createdAt: round.createdAt,
    settledAt: round.settledAt,
  };
}

async function settleGenericEuroRound(input: {
  db: any;
  userId: number;
  profile: typeof profiles.$inferSelect;
  gameKey: Exclude<(typeof EURO_GENERIC_GAME_KEYS)[number], "mining">;
  stakePkr: number;
  selection?: string | null;
}) {
  const outcome = chooseGenericGameOutcome({
    gameKey: input.gameKey,
    selection: input.selection,
  });
  const [activePackage, daily] = await Promise.all([
    getActivePackageForUser(input.userId),
    getGameDailyStat(input.db, input.userId, getDayKey()),
  ]);
  const capped = cappedAviatorPayout({
    stakePkr: input.stakePkr,
    multiplierX100: outcome.multiplierX100,
    priorProfitPkr: daily?.profitPkr ?? 0,
    dailyProfitLimitPkr: maxDailyGameProfit(activePackage?.plan.pricePkr),
  });
  const payoutPkr = outcome.multiplierX100 > 0 ? capped.payoutPkr : 0;
  const status = payoutPkr > 0 ? "settled" : "lost" as const;
  const id = randomUUID();
  const now = new Date();
  await input.db
    .update(profiles)
    .set({ gameBalancePkr: input.profile.gameBalancePkr - input.stakePkr + payoutPkr })
    .where(eq(profiles.userId, input.userId));
  await input.db.insert(gameRounds).values({
    id,
    userId: input.userId,
    gameKey: input.gameKey,
    stakePkr: input.stakePkr,
    selection: input.selection ?? null,
    publicState: JSON.stringify(outcome.publicState),
    multiplierX100: outcome.multiplierX100,
    payoutPkr,
    status,
    createdAt: now,
    settledAt: now,
  });
  await Promise.all([
    updateGameDailyStat(input.db, {
      userId: input.userId,
      profitPkr: capped.profitPkr,
      lossPkr: payoutPkr ? 0 : input.stakePkr,
    }),
    input.db.insert(gameWalletTransactions).values({
      userId: input.userId,
      type: "game_bet",
      direction: "debit",
      amountPkr: input.stakePkr,
      note: `${EURO_GAME_LABELS[input.gameKey]} bet placed`,
      referenceType: "game_round",
      referenceId: id,
    }),
    ...(payoutPkr
      ? [input.db.insert(gameWalletTransactions).values({
          userId: input.userId,
          type: "game_payout",
          direction: "credit",
          amountPkr: payoutPkr,
          note: `${EURO_GAME_LABELS[input.gameKey]} result ${(outcome.multiplierX100 / 100).toFixed(2)}x`,
          referenceType: "game_round",
          referenceId: id,
        })]
      : []),
  ]);
  return publicGenericGameRound({
    id,
    userId: input.userId,
    gameKey: input.gameKey,
    stakePkr: input.stakePkr,
    selection: input.selection ?? null,
    privateState: null,
    publicState: JSON.stringify(outcome.publicState),
    multiplierX100: outcome.multiplierX100,
    payoutPkr,
    status,
    createdAt: now,
    settledAt: now,
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user ? publicUser(opts.ctx.user) : null
    ),
    captcha: publicProcedure
      .input(
        z.object({
          purpose: z.enum(["sign_in", "sign_up"]),
          deviceId: z.string().trim().min(16).max(256),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const challenge = createHumanChallenge();
        await db.insert(authChallenges).values({
          id: challenge.id,
          purpose: input.purpose,
          prompt: challenge.prompt,
          answerHash: challenge.answerHash,
          deviceFingerprintHash: hashSecurityValue(input.deviceId),
          expiresAt: challenge.expiresAt,
        });
        return {
          id: challenge.id,
          prompt: challenge.prompt,
          imageData: challenge.imageData,
          expiresAt: challenge.expiresAt,
        };
      }),
    register: publicProcedure
      .input(
        z.object({
          username: z
            .string()
            .trim()
            .min(3)
            .max(32)
            .regex(
              /^[a-zA-Z0-9_]+$/,
              "Use letters, numbers, and underscores only."
            ),
          email: z
            .string()
            .trim()
            .email("You entered wrong Gmail/Email, please correct your Gmail")
            .max(320),
          password: z
            .string()
            .min(8, "Your password is incorrect/weak, please enter strong password")
            .max(128),
          referralCode: z.string().trim().max(32).optional(),
          challengeId: z.string().uuid(),
          challengeAnswer: z.string().trim().min(1).max(32),
          deviceId: z.string().trim().min(16).max(256),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const email = input.email.toLowerCase();
        const username = input.username.toLowerCase();
        const deviceFingerprintHash = await consumeHumanChallenge(db, {
          challengeId: input.challengeId,
          challengeAnswer: input.challengeAnswer,
          deviceId: input.deviceId,
          purpose: "sign_up",
        });
        const registrationIpHash = hashSecurityValue(
          clientIpFromHeaders(
            ctx.req.headers as Record<string, string | string[] | undefined>
          )
        );
        const isDesignated =
          email === ADMIN_EMAIL && username === "danyal955163";
        if (username === "danyal955163" && !isDesignated)
          fail(
            "This username is reserved for the designated administrator.",
            "FORBIDDEN"
          );
        if (email === ADMIN_EMAIL && !isDesignated)
          fail(
            "This email must use the designated administrator username.",
            "FORBIDDEN"
          );
        const [emailMatch, usernameMatch, deviceMatch, networkMatch] =
          await Promise.all([
          db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1),
          db
            .select({ id: profiles.id })
            .from(profiles)
            .where(eq(profiles.username, username))
            .limit(1),
          db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.deviceFingerprintHash, deviceFingerprintHash))
            .limit(1),
          db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.registrationIpHash, registrationIpHash))
            .limit(1),
        ]);
        if (emailMatch[0])
          fail("This Email/Gmail is already registered", "CONFLICT");
        if (usernameMatch[0])
          fail("This username already exists, please choose another", "CONFLICT");
        if (deviceMatch[0] || networkMatch[0])
          fail("You cannot create multiple accounts on same device, only one account allowed per device", "FORBIDDEN");
        let referredByUserId: number | null = null;
        if (input.referralCode) {
          const referralValue = input.referralCode.trim();
          let referrer = (
            await db
              .select()
              .from(profiles)
              .where(eq(profiles.referralCode, referralValue.toUpperCase()))
              .limit(1)
          )[0];
          if (!referrer)
            referrer = (
              await db
                .select()
                .from(profiles)
                .where(eq(profiles.username, referralValue.toLowerCase()))
                .limit(1)
            )[0];
          if (!referrer) fail("Referral code or username was not found.");
          referredByUserId = referrer.userId;
        }
        const created = await db.insert(users).values({
          openId: `local_${randomUUID()}`,
          name: username,
          email,
          passwordHash: await hashPassword(input.password),
          deviceFingerprintHash,
          registrationIpHash,
          loginMethod: "password",
          role: isDesignated ? "admin" : "user",
          lastSignedIn: new Date(),
        });
        const userId = Number(created[0].insertId);
        await db.insert(profiles).values({
          userId,
          username,
          referralCode: `PEP${userId.toString(36).toUpperCase()}`,
          referredByUserId,
          balancePkr: 0,
          withdrawalLimitPkr: 0,
          preferredCurrency: "PKR",
          whatsappRewardEligible: true,
        });
        const user = (
          await db.select().from(users).where(eq(users.id, userId)).limit(1)
        )[0];
        if (!user) fail("Account creation failed.", "INTERNAL_SERVER_ERROR");
        ctx.res.cookie(
          LOCAL_SESSION_COOKIE,
          await createLocalSession(user.id),
          {
            ...getSessionCookieOptions(ctx.req),
            maxAge: 7 * 24 * 60 * 60 * 1000,
          }
        );
        return { user: publicUser(user) };
      }),
    signIn: publicProcedure
      .input(
        z.object({
          email: z
            .string()
            .trim()
            .email("You entered wrong Gmail/Email, please correct your Gmail")
            .max(320),
          password: z.string().min(8, "Your password is incorrect/weak, please enter strong password"),
          challengeId: z.string().uuid(),
          challengeAnswer: z.string().trim().min(1).max(32),
          deviceId: z.string().trim().min(16).max(256),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await consumeHumanChallenge(db, {
          challengeId: input.challengeId,
          challengeAnswer: input.challengeAnswer,
          deviceId: input.deviceId,
          purpose: "sign_in",
        });
        const user = (
          await db
            .select()
            .from(users)
            .where(eq(users.email, input.email.toLowerCase()))
            .limit(1)
        )[0];
        if (!user || !(await verifyPassword(input.password, user.passwordHash)))
          fail("Incorrect email or password.", "UNAUTHORIZED");
        const profile = await ensureProfile(user);
        if (profile.isBlocked)
          fail(
            "Your account is currently restricted. Please contact support.",
            "FORBIDDEN"
          );
        await db
          .update(users)
          .set({ lastSignedIn: new Date() })
          .where(eq(users.id, user.id));
        ctx.res.cookie(
          LOCAL_SESSION_COOKIE,
          await createLocalSession(user.id),
          {
            ...getSessionCookieOptions(ctx.req),
            maxAge: 7 * 24 * 60 * 60 * 1000,
          }
        );
        return { user: publicUser(user) };
      }),
    setPassword: protectedProcedure
      .input(
        z.object({
          password: z
            .string()
            .min(8, "Password must be at least 8 characters.")
            .max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .update(users)
          .set({
            passwordHash: await hashPassword(input.password),
            loginMethod: "password",
          })
          .where(eq(users.id, ctx.user.id));
        ctx.res.cookie(
          LOCAL_SESSION_COOKIE,
          await createLocalSession(ctx.user.id),
          {
            ...getSessionCookieOptions(ctx.req),
            maxAge: 7 * 24 * 60 * 60 * 1000,
          }
        );
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),
  account: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      return {
        user: publicUser(user),
        profile,
        isAdmin: isDesignatedAdmin(user, profile),
      };
    }),
    saveProfile: protectedProcedure
      .input(
        z.object({
          username: z
            .string()
            .trim()
            .min(3)
            .max(32)
            .regex(
              /^[a-zA-Z0-9_]+$/,
              "Use letters, numbers, and underscores only."
            ),
          referralCode: z.string().trim().max(32).optional(),
          preferredCurrency: z.enum(["PKR", "USD"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const requestedName = input.username.toLowerCase();
        if (
          requestedName === "danyal955163" &&
          user.email?.toLowerCase() !== ADMIN_EMAIL
        )
          fail(
            "This username is reserved for the designated administrator.",
            "FORBIDDEN"
          );
        const duplicate = await db
          .select()
          .from(profiles)
          .where(eq(profiles.username, requestedName))
          .limit(1);
        if (duplicate[0] && duplicate[0].userId !== user.id)
          fail("That username is already in use.");
        let referredByUserId = profile.referredByUserId;
        if (input.referralCode && !referredByUserId) {
          const referralValue = input.referralCode.trim();
          let referrer = (
            await db
              .select()
              .from(profiles)
              .where(eq(profiles.referralCode, referralValue.toUpperCase()))
              .limit(1)
          )[0];
          if (!referrer)
            referrer = (
              await db
                .select()
                .from(profiles)
                .where(eq(profiles.username, referralValue.toLowerCase()))
                .limit(1)
            )[0];
          if (!referrer) fail("Referral code or username was not found.");
          if (referrer.userId === user.id)
            fail("You cannot use your own referral code.");
          referredByUserId = referrer.userId;
        }
        if (
          isDesignatedAdmin(user, profile) &&
          requestedName !== "danyal955163"
        )
          fail("The designated administrator username cannot be changed.");
        await db
          .update(profiles)
          .set({
            username: requestedName,
            preferredCurrency: input.preferredCurrency,
            referredByUserId,
          })
          .where(eq(profiles.userId, user.id));
        return { success: true };
      }),
  }),
  platform: router({
    publicData: publicProcedure.query(async () => {
      await ensurePlatformData();
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const settings = await getSettings();
      return {
        packages: await db
          .select()
          .from(packages)
          .where(eq(packages.isActive, true)),
        branding: {
          websiteName: settings.websiteName,
          themeName: settings.themeName,
          buttonColor: settings.buttonColor ?? "amber",
          logoUrl: settings.logoData || settings.logoUrl,
        },
      };
    }),
    overview: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      return buildOverview(user.id);
    }),
    announcements: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select()
        .from(broadcasts)
        .orderBy(desc(broadcasts.createdAt))
        .limit(10);
    }),
    joinWhatsApp: protectedProcedure.mutation(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (!profile.whatsappRewardEligible)
        return { success: true, bonusPkr: 0, alreadyJoined: true } as const;
      if (profile.whatsappJoined || profile.whatsappBonusClaimed)
        return { success: true, bonusPkr: 0, alreadyJoined: true } as const;
      await db
        .update(profiles)
        .set({
          whatsappJoined: true,
          whatsappBonusClaimed: true,
          balancePkr: profile.balancePkr + WHATSAPP_JOIN_REWARD_PKR,
          withdrawalLimitPkr:
            profile.withdrawalLimitPkr + WHATSAPP_JOIN_REWARD_PKR,
        })
        .where(eq(profiles.userId, user.id));
      await db.insert(transactions).values({
        userId: user.id,
        type: "adjustment",
        direction: "credit",
        amountPkr: WHATSAPP_JOIN_REWARD_PKR,
        status: "completed",
        note: "WhatsApp Channel join bonus",
        referenceType: "whatsapp_bonus",
        referenceId: user.id,
      });
      return {
        success: true,
        bonusPkr: WHATSAPP_JOIN_REWARD_PKR,
        alreadyJoined: false,
      } as const;
    }),
  }),
  package: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await ensurePlatformData();
      return db.select().from(packages).where(eq(packages.isActive, true));
    }),
    buy: protectedProcedure
      .input(z.object({ packageId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const plan = (
          await db
            .select()
            .from(packages)
            .where(
              and(eq(packages.id, input.packageId), eq(packages.isActive, true))
            )
            .limit(1)
        )[0];
        if (!plan) fail("That package is not available.", "NOT_FOUND");
        if (profile.balancePkr < plan.pricePkr)
          fail(
            "Your wallet balance is insufficient. Please deposit funds first."
          );
        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + plan.durationDays * 86_400_000
        );
        await db
          .update(profiles)
          .set({ balancePkr: profile.balancePkr - plan.pricePkr })
          .where(eq(profiles.userId, user.id));
        await db.insert(userPackages).values({
          userId: user.id,
          packageId: plan.id,
          purchasedAt: now,
          expiresAt,
        });
        await db.insert(transactions).values({
          userId: user.id,
          type: "package",
          direction: "debit",
          amountPkr: plan.pricePkr,
          status: "completed",
          note: `${plan.name} package purchased`,
        });
        if (profile.referredByUserId) {
          const settings = await getSettings();
          const credit = referralLimitCredit(
            plan.pricePkr,
            settings.referralCommissionPercent
          );
          const referrer = (
            await db
              .select()
              .from(profiles)
              .where(eq(profiles.userId, profile.referredByUserId))
              .limit(1)
          )[0];
          if (referrer) {
            await db
              .update(profiles)
              .set({ withdrawalLimitPkr: referrer.withdrawalLimitPkr + credit })
              .where(eq(profiles.userId, referrer.userId));
            await db.insert(transactions).values({
              userId: referrer.userId,
              type: "referral_limit",
              direction: "neutral",
              amountPkr: credit,
              status: "completed",
              note: `Referral withdrawal limit unlocked by ${plan.name} purchase`,
            });
          }
        }
        return { success: true, expiresAt };
      }),
  }),
  wallet: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const data = await buildOverview(user.id);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const recent = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, user.id))
        .orderBy(desc(transactions.createdAt))
        .limit(5);
      return {
        ...data,
        recent,
        balanceUsd: fromPkr(
          data.profile.balancePkr,
          data.settings.exchangeRatePkrPerUsd
        ),
        withdrawalLimitUsd: fromPkr(
          data.profile.withdrawalLimitPkr,
          data.settings.exchangeRatePkrPerUsd
        ),
      };
    }),
    transactions: protectedProcedure
      .input(
        z.object({
          type: z
            .enum([
              "all",
              "deposit",
              "package",
              "ad_reward",
              "withdrawal",
              "referral_limit",
              "adjustment",
            ])
            .default("all"),
          status: z
            .enum(["all", "pending", "approved", "rejected", "completed"])
            .default("all"),
        })
      )
      .query(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const rows = await db
          .select()
          .from(transactions)
          .where(eq(transactions.userId, user.id))
          .orderBy(desc(transactions.createdAt));
        return rows.filter(
          row =>
            (input.type === "all" || row.type === input.type) &&
            (input.status === "all" || row.status === input.status)
        );
      }),
  }),
  euro: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [settings, activePackage] = await Promise.all([
        getSettings(),
        getActivePackageForUser(user.id),
      ]);
      const currentRound = await settleExpiredAviatorRound(db, user.id);
      const dayKey = getDayKey();
      const [daily, recent, activeTasks, activeBets, taskClaims] = await Promise.all([
        getGameDailyStat(db, user.id, dayKey),
        db
          .select()
          .from(gameWalletTransactions)
          .where(eq(gameWalletTransactions.userId, user.id))
          .orderBy(desc(gameWalletTransactions.createdAt))
          .limit(12),
        db
          .select()
          .from(gameTasks)
          .where(eq(gameTasks.isActive, true))
          .orderBy(desc(gameTasks.updatedAt)),
        currentRound
          ? db
              .select()
              .from(aviatorBets)
              .where(
                and(
                  eq(aviatorBets.roundId, currentRound.id),
                  eq(aviatorBets.userId, user.id)
                )
              )
          : Promise.resolve([]),
        db
          .select()
          .from(gameTaskClaims)
          .where(eq(gameTaskClaims.userId, user.id))
          .orderBy(desc(gameTaskClaims.claimedAt)),
      ]);
      const claimedTaskKeys = new Set(
        taskClaims.map(claim => `${claim.taskKey}:${claim.dayKey}`)
      );
      const systemTasks = [
        {
          key: "whatsapp",
          title: "Join WhatsApp Channel",
          targetUrl: "https://whatsapp.com/channel/0029VbDB4LpDZ4LhbhGZsJ10",
          rewardPkr: 20,
          claimed: claimedTaskKeys.has("whatsapp:lifetime"),
          ready: profile.whatsappJoined,
        },
        {
          key: "watch_ad",
          title: "Watch Ad",
          targetUrl: "#ads",
          rewardPkr: 20,
          claimed: claimedTaskKeys.has(`watch_ad:${dayKey}`),
          ready: false,
        },
      ];
      return {
        gameBalancePkr: profile.gameBalancePkr,
        mainBalancePkr: profile.balancePkr,
        canClaimBonus: profile.euroBonusEligible && !profile.euroBonusClaimed,
        bonusPkr: settings.euroBonusPkr,
        activePackagePricePkr: activePackage?.plan.pricePkr ?? null,
        canExchangeToMain: Boolean(activePackage),
        dailyProfitPkr: daily?.profitPkr ?? 0,
        dailyProfitLimitPkr: maxDailyGameProfit(activePackage?.plan.pricePkr),
        settings: {
          aviatorEnabled: settings.euroAviatorEnabled,
          minimumBetPkr: settings.euroMinimumBetPkr,
          maximumBetPkr: settings.euroMaximumBetPkr,
        },
        round: publicAviatorRound(currentRound),
        activeBets,
        recent,
        tasks: activeTasks,
        systemTasks,
      };
    }),
    claimFirstVisitBonus: protectedProcedure.mutation(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const settings = await getSettings();
      if (!profile.euroBonusEligible || profile.euroBonusClaimed)
        return { success: true, bonusPkr: 0, alreadyClaimed: true } as const;
      const bonusPkr = settings.euroBonusPkr;
      await db
        .update(profiles)
        .set({
          gameBalancePkr: profile.gameBalancePkr + bonusPkr,
          euroBonusClaimed: true,
        })
        .where(eq(profiles.userId, user.id));
      await db.insert(gameWalletTransactions).values({
        userId: user.id,
        type: "bonus",
        direction: "credit",
        amountPkr: bonusPkr,
        note: "Euro first-visit game bonus",
        referenceType: "euro_bonus",
        referenceId: String(user.id),
      });
      return { success: true, bonusPkr, alreadyClaimed: false } as const;
    }),
    exchangeFromMain: protectedProcedure
      .input(z.object({ amountPkr: z.number().int().positive().max(1_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        if (profile.balancePkr < input.amountPkr)
          fail("Your Main Wallet balance is insufficient for this transfer.");
        await db
          .update(profiles)
          .set({
            balancePkr: profile.balancePkr - input.amountPkr,
            gameBalancePkr: profile.gameBalancePkr + input.amountPkr,
          })
          .where(eq(profiles.userId, user.id));
        await Promise.all([
          db.insert(gameWalletTransactions).values({
            userId: user.id,
            type: "main_to_game",
            direction: "credit",
            amountPkr: input.amountPkr,
            note: "Transferred from Main Wallet to Game Wallet",
            referenceType: "wallet_exchange",
            referenceId: randomUUID(),
          }),
          db.insert(transactions).values({
            userId: user.id,
            type: "adjustment",
            direction: "debit",
            amountPkr: input.amountPkr,
            status: "completed",
            note: "Transferred to Euro Game Wallet",
            referenceType: "euro_exchange",
          }),
        ]);
        return { success: true };
      }),
    exchangeToMain: protectedProcedure
      .input(z.object({ amountPkr: z.number().int().positive().max(1_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const activePackage = await getActivePackageForUser(user.id);
        if (!activePackage)
          fail("Please buy a package and then convert into Main Wallet");
        if (profile.gameBalancePkr < input.amountPkr)
          fail("Your Game Wallet balance is insufficient for this transfer.");
        await db
          .update(profiles)
          .set({
            balancePkr: profile.balancePkr + input.amountPkr,
            gameBalancePkr: profile.gameBalancePkr - input.amountPkr,
          })
          .where(eq(profiles.userId, user.id));
        await Promise.all([
          db.insert(gameWalletTransactions).values({
            userId: user.id,
            type: "game_to_main",
            direction: "debit",
            amountPkr: input.amountPkr,
            note: "Transferred from Game Wallet to Main Wallet",
            referenceType: "wallet_exchange",
            referenceId: randomUUID(),
          }),
          db.insert(transactions).values({
            userId: user.id,
            type: "adjustment",
            direction: "credit",
            amountPkr: input.amountPkr,
            status: "completed",
            note: "Transferred from Euro Game Wallet",
            referenceType: "euro_exchange",
          }),
        ]);
        return { success: true };
      }),
    aviatorState: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const round = await settleExpiredAviatorRound(db, user.id);
      const bets = round
        ? await db
            .select()
            .from(aviatorBets)
            .where(
              and(
                eq(aviatorBets.roundId, round.id),
                eq(aviatorBets.userId, user.id)
              )
            )
        : [];
      return { round: publicAviatorRound(round), bets, serverNow: new Date() };
    }),
    startAviator: protectedProcedure
      .input(
        z.object({
          stakesPkr: z.array(z.number().int().positive()).min(1).max(2),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const settings = await getSettings();
        if (!settings.euroAviatorEnabled) fail("Aviator is currently unavailable.");
        const currentRound = await settleExpiredAviatorRound(db, user.id);
        if (currentRound?.status === "active")
          fail("Please finish the current Aviator round before starting another.");
        const stakes = input.stakesPkr;
        const totalStakePkr = stakes.reduce((total, stake) => total + stake, 0);
        for (const stake of stakes) {
          const betError = validateEuroBetAmount(
            stake,
            settings.euroMinimumBetPkr,
            settings.euroMaximumBetPkr
          );
          if (betError) fail(betError);
        }
        if (profile.gameBalancePkr < totalStakePkr)
          fail("Your Game Wallet balance is insufficient for this Aviator bet.");
        const startsAt = new Date();
        const crashMultiplierX100 = chooseCrashMultiplierX100(
          settings.euroCrashBandWeights
        );
        const id = randomUUID();
        const crashesAt = crashTimeFor(startsAt, crashMultiplierX100);
        await db
          .update(profiles)
          .set({ gameBalancePkr: profile.gameBalancePkr - totalStakePkr })
          .where(eq(profiles.userId, user.id));
        await db.insert(aviatorRounds).values({
          id,
          userId: user.id,
          crashMultiplierX100,
          startsAt,
          crashesAt,
        });
        const created = await db
          .insert(aviatorBets)
          .values(stakes.map(stakePkr => ({ roundId: id, userId: user.id, stakePkr })));
        await db.insert(gameWalletTransactions).values(
          stakes.map(stakePkr => ({
            userId: user.id,
            type: "aviator_bet" as const,
            direction: "debit" as const,
            amountPkr: stakePkr,
            note: "Aviator bet placed",
            referenceType: "aviator_round",
            referenceId: id,
          }))
        );
        const createdBets = await db
          .select()
          .from(aviatorBets)
          .where(eq(aviatorBets.roundId, id));
        return {
          round: publicAviatorRound({
            id,
            userId: user.id,
            crashMultiplierX100,
            startsAt,
            crashesAt,
            status: "active",
            createdAt: startsAt,
          }),
          bets: createdBets,
          insertedBetCount: Array.isArray(created) ? stakes.length : stakes.length,
        };
      }),
    cashOutAviator: protectedProcedure
      .input(z.object({ betId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const bet = (
          await db
            .select()
            .from(aviatorBets)
            .where(
              and(eq(aviatorBets.id, input.betId), eq(aviatorBets.userId, user.id))
            )
            .limit(1)
        )[0];
        if (!bet || bet.status !== "active") fail("This Aviator bet is no longer available.");
        const round = (
          await db
            .select()
            .from(aviatorRounds)
            .where(eq(aviatorRounds.id, bet.roundId))
            .limit(1)
        )[0];
        if (!round) fail("Aviator round was not found.");
        const now = new Date();
        if (now.getTime() >= round.crashesAt.getTime()) {
          await settleExpiredAviatorRound(db, user.id, now);
          fail("The Aviator round has already crashed.");
        }
        const multiplierX100 = Math.min(
          round.crashMultiplierX100,
          multiplierAt(now, round.startsAt)
        );
        const activePackage = await getActivePackageForUser(user.id);
        const daily = await getGameDailyStat(db, user.id, getDayKey());
        const result = cappedAviatorPayout({
          stakePkr: bet.stakePkr,
          multiplierX100,
          priorProfitPkr: daily?.profitPkr ?? 0,
          dailyProfitLimitPkr: maxDailyGameProfit(activePackage?.plan.pricePkr),
        });
        await db
          .update(aviatorBets)
          .set({
            status: "cashed_out",
            payoutPkr: result.payoutPkr,
            cashoutMultiplierX100: multiplierX100,
            settledAt: now,
          })
          .where(eq(aviatorBets.id, bet.id));
        await db
          .update(profiles)
          .set({ gameBalancePkr: profile.gameBalancePkr + result.payoutPkr })
          .where(eq(profiles.userId, user.id));
        await Promise.all([
          updateGameDailyStat(db, { userId: user.id, profitPkr: result.profitPkr }),
          db.insert(gameWalletTransactions).values({
            userId: user.id,
            type: "aviator_payout",
            direction: "credit",
            amountPkr: result.payoutPkr,
            note: `Aviator cash-out at ${(multiplierX100 / 100).toFixed(2)}x`,
            referenceType: "aviator_bet",
            referenceId: String(bet.id),
          }),
        ]);
        return {
          success: true,
          payoutPkr: result.payoutPkr,
          multiplierX100,
          capped: result.payoutPkr < Math.floor((bet.stakePkr * multiplierX100) / 100),
        };
      }),
    gameState: protectedProcedure
      .input(z.object({ gameKey: z.enum(EURO_GENERIC_GAME_KEYS) }))
      .query(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const activeRound = (
          await db
            .select()
            .from(gameRounds)
            .where(and(eq(gameRounds.userId, user.id), eq(gameRounds.gameKey, input.gameKey), eq(gameRounds.status, "active")))
            .orderBy(desc(gameRounds.createdAt))
            .limit(1)
        )[0] ?? null;
        const recent = await db
          .select()
          .from(gameRounds)
          .where(and(eq(gameRounds.userId, user.id), eq(gameRounds.gameKey, input.gameKey)))
          .orderBy(desc(gameRounds.createdAt))
          .limit(6);
        return { activeRound: publicGenericGameRound(activeRound), recent: recent.map(publicGenericGameRound) };
      }),
    playGame: protectedProcedure
      .input(z.object({
        gameKey: z.enum(EURO_GENERIC_GAME_KEYS),
        stakePkr: z.number().int().positive(),
        selection: z.string().trim().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const settings = await getSettings();
        const label = EURO_GAME_LABELS[input.gameKey];
        const betError = validateEuroBetAmount(input.stakePkr, settings.euroMinimumBetPkr, settings.euroMaximumBetPkr, label);
        if (betError) fail(betError);
        const selectionError = validateGenericGameSelection(input.gameKey, input.selection);
        if (selectionError) fail(selectionError);
        if (profile.gameBalancePkr < input.stakePkr)
          fail(`Your Game Wallet balance is insufficient for this ${label} bet.`);
        if (input.gameKey !== "mining") {
          const round = await settleGenericEuroRound({
            db,
            userId: user.id,
            profile,
            gameKey: input.gameKey,
            stakePkr: input.stakePkr,
            selection: input.selection,
          });
          return { round };
        }
        const existing = (
          await db
            .select({ id: gameRounds.id })
            .from(gameRounds)
            .where(and(eq(gameRounds.userId, user.id), eq(gameRounds.gameKey, "mining"), eq(gameRounds.status, "active")))
            .limit(1)
        )[0];
        if (existing) fail("Finish the current Mining round before starting another.");
        const id = randomUUID();
        const now = new Date();
        const state = createMiningState();
        await db.update(profiles).set({ gameBalancePkr: profile.gameBalancePkr - input.stakePkr }).where(eq(profiles.userId, user.id));
        await Promise.all([
          db.insert(gameRounds).values({
            id,
            userId: user.id,
            gameKey: "mining",
            stakePkr: input.stakePkr,
            privateState: JSON.stringify(state),
            publicState: JSON.stringify({ revealed: [] }),
            multiplierX100: 100,
            createdAt: now,
          }),
          db.insert(gameWalletTransactions).values({
            userId: user.id,
            type: "game_bet",
            direction: "debit",
            amountPkr: input.stakePkr,
            note: "Mining bet placed",
            referenceType: "game_round",
            referenceId: id,
          }),
        ]);
        return { round: publicGenericGameRound({ id, userId: user.id, gameKey: "mining", stakePkr: input.stakePkr, selection: null, privateState: JSON.stringify(state), publicState: JSON.stringify({ revealed: [] }), multiplierX100: 100, payoutPkr: 0, status: "active", createdAt: now, settledAt: null }) };
      }),
    revealMining: protectedProcedure
      .input(z.object({ roundId: z.string().uuid(), tileIndex: z.number().int().min(0).max(24) }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const round = (
          await db.select().from(gameRounds).where(and(eq(gameRounds.id, input.roundId), eq(gameRounds.userId, user.id), eq(gameRounds.gameKey, "mining"))).limit(1)
        )[0];
        if (!round || round.status !== "active") fail("This Mining round is no longer active.");
        const privateState = parseEuroState(round.privateState);
        const publicState = parseEuroState(round.publicState);
        const revealed = Array.isArray(privateState.revealed) ? privateState.revealed.map(Number) : [];
        const bombs = Array.isArray(privateState.bombs) ? privateState.bombs.map(Number) : [];
        if (revealed.includes(input.tileIndex)) fail("This Mining tile was already revealed.");
        const nextRevealed = [...revealed, input.tileIndex];
        const hitBomb = bombs.includes(input.tileIndex);
        const now = new Date();
        const nextPublic = { ...publicState, revealed: nextRevealed, bombTile: hitBomb ? input.tileIndex : null };
        if (hitBomb) {
          await Promise.all([
            db.update(gameRounds).set({ privateState: JSON.stringify({ ...privateState, revealed: nextRevealed }), publicState: JSON.stringify(nextPublic), multiplierX100: 0, status: "lost", settledAt: now }).where(eq(gameRounds.id, round.id)),
            updateGameDailyStat(db, { userId: user.id, lossPkr: round.stakePkr }),
          ]);
          return { hitBomb: true, round: publicGenericGameRound({ ...round, privateState: JSON.stringify({ ...privateState, revealed: nextRevealed }), publicState: JSON.stringify(nextPublic), multiplierX100: 0, status: "lost", settledAt: now }) };
        }
        const multiplierX100 = miningMultiplierX100(nextRevealed.length);
        await db.update(gameRounds).set({ privateState: JSON.stringify({ ...privateState, revealed: nextRevealed }), publicState: JSON.stringify(nextPublic), multiplierX100 }).where(eq(gameRounds.id, round.id));
        return { hitBomb: false, round: publicGenericGameRound({ ...round, privateState: JSON.stringify({ ...privateState, revealed: nextRevealed }), publicState: JSON.stringify(nextPublic), multiplierX100 }) };
      }),
    cashOutMining: protectedProcedure
      .input(z.object({ roundId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const [round, currentProfile, activePackage, daily] = await Promise.all([
          db.select().from(gameRounds).where(and(eq(gameRounds.id, input.roundId), eq(gameRounds.userId, user.id), eq(gameRounds.gameKey, "mining"), eq(gameRounds.status, "active"))).limit(1).then((rows: any[]) => rows[0]),
          db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1).then((rows: any[]) => rows[0]),
          getActivePackageForUser(user.id),
          getGameDailyStat(db, user.id, getDayKey()),
        ]);
        if (!round || !currentProfile) fail("This Mining round is no longer active.");
        const state = parseEuroState(round.privateState);
        if (!Array.isArray(state.revealed) || state.revealed.length === 0) fail("Reveal one safe Mining tile before cashing out.");
        const result = cappedAviatorPayout({ stakePkr: round.stakePkr, multiplierX100: round.multiplierX100, priorProfitPkr: daily?.profitPkr ?? 0, dailyProfitLimitPkr: maxDailyGameProfit(activePackage?.plan.pricePkr) });
        const now = new Date();
        await Promise.all([
          db.update(gameRounds).set({ payoutPkr: result.payoutPkr, status: "cashed_out", settledAt: now }).where(eq(gameRounds.id, round.id)),
          db.update(profiles).set({ gameBalancePkr: currentProfile.gameBalancePkr + result.payoutPkr }).where(eq(profiles.userId, user.id)),
          updateGameDailyStat(db, { userId: user.id, profitPkr: result.profitPkr }),
          db.insert(gameWalletTransactions).values({ userId: user.id, type: "game_payout", direction: "credit", amountPkr: result.payoutPkr, note: `Mining cash-out at ${(round.multiplierX100 / 100).toFixed(2)}x`, referenceType: "game_round", referenceId: round.id }),
        ]);
        return { success: true, payoutPkr: result.payoutPkr, multiplierX100: round.multiplierX100 };
      }),
    claimTaskReward: protectedProcedure
      .input(z.object({ taskKey: z.enum(["whatsapp", "watch_ad"]) }))
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const dayKey = input.taskKey === "watch_ad" ? getDayKey() : "lifetime";
        const existing = (await db.select({ id: gameTaskClaims.id }).from(gameTaskClaims).where(and(eq(gameTaskClaims.userId, user.id), eq(gameTaskClaims.taskKey, input.taskKey), eq(gameTaskClaims.dayKey, dayKey))).limit(1))[0];
        if (existing) fail("This Game Wallet task reward was already claimed.");
        if (input.taskKey === "whatsapp" && !profile.whatsappJoined) fail("Please join the WhatsApp channel first, then claim this Game Wallet task reward.");
        if (input.taskKey === "watch_ad") {
          const watched = (await db.select().from(adSessions).where(and(eq(adSessions.userId, user.id), eq(adSessions.dayKey, dayKey)))).some(session => Boolean(session.claimedAt));
          if (!watched) fail("Please complete and claim a daily ad first, then claim this Game Wallet task reward.");
        }
        const rewardPkr = 20;
        await Promise.all([
          db.update(profiles).set({ gameBalancePkr: profile.gameBalancePkr + rewardPkr }).where(eq(profiles.userId, user.id)),
          db.insert(gameTaskClaims).values({ userId: user.id, taskKey: input.taskKey, dayKey, rewardPkr }),
          db.insert(gameWalletTransactions).values({ userId: user.id, type: "task_reward", direction: "credit", amountPkr: rewardPkr, note: `${input.taskKey === "whatsapp" ? "WhatsApp" : "Daily ad"} task reward`, referenceType: "game_task", referenceId: `${input.taskKey}:${dayKey}` }),
        ]);
        return { success: true, rewardPkr, taskKey: input.taskKey };
      }),
  }),
  earning: router({
    ads: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [activePackage, activeAds] = await Promise.all([
        getActivePackageForUser(user.id),
        db.select().from(ads).where(eq(ads.isActive, true)).orderBy(ads.id),
      ]);
      const dayKey = getDayKey();
      const sessions = await db
        .select()
        .from(adSessions)
        .where(
          and(eq(adSessions.userId, user.id), eq(adSessions.dayKey, dayKey))
        );
      const watchedAdIds = new Set(
        sessions
          .filter(session => session.claimedAt)
          .map(session => session.adId)
      );
      const quota = activePackage
        ? getDailyAdQuota(activePackage.plan.pricePkr)
        : 0;
      const stateById = new Map(
        getDailyAdStates(
          activeAds.map(ad => ad.id),
          quota,
          watchedAdIds
        ).map(item => [item.id, item.state])
      );
      return {
        ads: activeAds.map(ad => ({
          ...ad,
          state: stateById.get(ad.id) ?? "locked",
        })),
        watched: watchedAdIds.size,
        total: Math.min(quota, activeAds.length),
        resetAt: getNextPakistanMidnight(),
        activePackage: activePackage
          ? {
              name: activePackage.plan.name,
              pricePkr: activePackage.plan.pricePkr,
              quota,
            }
          : null,
      };
    }),
    startAd: protectedProcedure
      .input(z.object({ adId: z.number().int().positive() }).optional())
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        if (!input) fail("Select an unlocked ad to begin.");
        const active = await getActivePackageForUser(user.id);
        if (!active)
          fail("Please purchase an active package to start earning.");
        const dayKey = getDayKey();
        const activeAds = await db
          .select()
          .from(ads)
          .where(eq(ads.isActive, true))
          .orderBy(ads.id);
        const sessions = await db
          .select()
          .from(adSessions)
          .where(
            and(eq(adSessions.userId, user.id), eq(adSessions.dayKey, dayKey))
          );
        const watchedAdIds = new Set(
          sessions
            .filter(session => session.claimedAt)
            .map(session => session.adId)
        );
        const quota = getDailyAdQuota(active.plan.pricePkr);
        const stateById = new Map(
          getDailyAdStates(
            activeAds.map(ad => ad.id),
            quota,
            watchedAdIds
          ).map(item => [item.id, item.state])
        );
        const available = activeAds.find(ad => ad.id === input.adId);
        if (!available || stateById.get(available.id) !== "unlocked")
          fail(
            "This ad is locked or has already been watched today.",
            "FORBIDDEN"
          );
        if (
          sessions.some(
            session =>
              session.adId === available.id &&
              !session.claimedAt &&
              !session.invalidatedAt
          )
        )
          fail(
            "This ad is already open. Complete it or wait for it to expire.",
            "CONFLICT"
          );
        const startedAt = new Date();
        const result = await db.insert(adSessions).values({
          userId: user.id,
          userPackageId: active.ownership.id,
          adId: available.id,
          dayKey,
          startedAt,
          lastHeartbeatAt: startedAt,
          rewardPkr: AD_REWARD_PKR,
        });
        const settings = await getSettings();
        return {
          sessionId: Number(result[0].insertId),
          ad: available,
          startedAt,
          availableAt: new Date(
            startedAt.getTime() + settings.adTimerSeconds * 1000
          ),
          timerSeconds: settings.adTimerSeconds,
        };
      }),
    heartbeat: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const session = (
          await db
            .select()
            .from(adSessions)
            .where(
              and(
                eq(adSessions.id, input.sessionId),
                eq(adSessions.userId, user.id)
              )
            )
            .limit(1)
        )[0];
        if (!session || session.claimedAt || session.invalidatedAt)
          fail(AD_TIMER_MESSAGE, "FORBIDDEN");
        await db
          .update(adSessions)
          .set({ lastHeartbeatAt: new Date() })
          .where(eq(adSessions.id, session.id));
        return { success: true };
      }),
    claimAd: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const session = (
          await db
            .select()
            .from(adSessions)
            .where(
              and(
                eq(adSessions.id, input.sessionId),
                eq(adSessions.userId, user.id)
              )
            )
            .limit(1)
        )[0];
        if (!session) fail("Earning session was not found.", "NOT_FOUND");
        if (session.claimedAt) fail("This reward has already been claimed.");
        const settings = await getSettings();
        const claimStatus = getAdClaimStatus({
          startedAt: session.startedAt,
          lastHeartbeatAt: session.lastHeartbeatAt,
          invalidatedAt: session.invalidatedAt,
          now: new Date(),
          timerSeconds: settings.adTimerSeconds,
        });
        if (claimStatus === "early") fail(AD_TIMER_MESSAGE);
        const profile = (
          await db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, user.id))
            .limit(1)
        )[0];
        if (!profile) fail("Profile was not found.", "NOT_FOUND");
        await db
          .update(adSessions)
          .set({ claimedAt: new Date() })
          .where(eq(adSessions.id, session.id));
        await db
          .update(profiles)
          .set({ balancePkr: profile.balancePkr + session.rewardPkr })
          .where(eq(profiles.userId, user.id));
        await db.insert(transactions).values({
          userId: user.id,
          type: "ad_reward",
          direction: "credit",
          amountPkr: session.rewardPkr,
          status: "completed",
          note: "Daily ad reward claimed",
        });
        return { success: true, rewardPkr: session.rewardPkr };
      }),
  }),
  deposit: router({
    accounts: protectedProcedure
      .input(z.object({ currency: z.enum(["PKR", "USD"]) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        return db
          .select()
          .from(paymentAccounts)
          .where(
            and(
              eq(paymentAccounts.currency, input.currency),
              eq(paymentAccounts.isActive, true)
            )
          );
      }),
    create: protectedProcedure
      .input(
        z.object({
          currency: z.enum(["PKR", "USD"]),
          amount: z.number().positive("Please deposit minimum 100 PKR"),
          method: z.string().trim().min(2).max(64),
          senderAccountNumber: z
            .string()
            .trim()
            .min(4, "Please enter correct JazzCash number linked with account")
            .max(256),
          senderAccountName: z.string().trim().min(2).max(128),
          transactionId: z
            .string()
            .trim()
            .min(3, "You entered wrong deposit number / Transaction ID, please enter correct TID")
            .max(128),
          requestedPackageId: z.number().int().positive().optional(),
          proofData: z.string().min(24).max(2_000_000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        if (
          input.currency === "PKR" &&
          !isValidPakistanMobileNumber(input.senderAccountNumber)
        )
          fail("Please enter correct JazzCash number linked with account");
        const settings = await getSettings();
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const proofData = validateInlineUpload(input.proofData, {
          label: "image proof",
          maxBytes: 1 * 1024 * 1024,
          acceptedType: contentType => contentType.startsWith("image/"),
        });
        const convertedAmountPkr = toPkr(
          input.amount,
          input.currency,
          settings.exchangeRatePkrPerUsd
        );
        const isUsdAmountWithinDisplayedRange =
          input.currency === "USD" && input.amount >= 0.35 && input.amount <= 53.57;
        const depositError = isUsdAmountWithinDisplayedRange
          ? null
          : validateDepositAmountPkr(convertedAmountPkr);
        if (depositError) fail(depositError);
        const amountPkr = isUsdAmountWithinDisplayedRange
          ? Math.max(100, Math.min(15000, convertedAmountPkr))
          : convertedAmountPkr;
        const duplicateTransaction = (
          await db
            .select({ id: deposits.id })
            .from(deposits)
            .where(eq(deposits.transactionId, input.transactionId))
            .limit(1)
        )[0];
        if (duplicateTransaction)
          fail("This transaction ID has already been submitted.", "CONFLICT");
        if (input.requestedPackageId) {
          const requestedPackage = (
            await db
              .select({ id: packages.id })
              .from(packages)
              .where(eq(packages.id, input.requestedPackageId))
              .limit(1)
          )[0];
          if (!requestedPackage) fail("Requested package was not found.", "NOT_FOUND");
        }
        const result = await db.insert(deposits).values({
          userId: user.id,
          currency: input.currency,
          amountPkr,
          method: input.method,
          senderAccountNumber: input.senderAccountNumber,
          senderAccountName: input.senderAccountName,
          transactionId: input.transactionId,
          requestedPackageId: input.requestedPackageId ?? null,
          proofUrl: "database",
          proofKey: "inline",
          proofData,
          status: "pending",
        });
        const depositId = Number(result[0].insertId);
        await db.insert(transactions).values({
          userId: user.id,
          type: "deposit",
          direction: "neutral",
          amountPkr,
          status: "pending",
          note: `${input.method} deposit (${input.transactionId}) awaiting approval`,
          referenceType: "deposit",
          referenceId: depositId,
        });
        void sendTelegramAlert(
          [
            "💰 NEW DEPOSIT",
            `👤 User: ${profile.username} (ID:${user.id})`,
            `💵 Amount: ${amountPkr} PKR`,
            `🆔 TRX: ${input.transactionId}`,
            `📱 From: ${input.senderAccountNumber}`,
          ].join("\n")
        );
        return { success: true };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select()
        .from(deposits)
        .where(eq(deposits.userId, user.id))
        .orderBy(desc(deposits.createdAt));
    }),
  }),
  withdrawal: router({
    create: protectedProcedure
      .input(
        z.object({
          currency: z.enum(["PKR", "USD"]),
          amount: z.number(),
          walletType: z.string().trim().max(64),
          accountName: z.string().trim().max(128),
          accountDetails: z.string().trim().max(512),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const settings = await getSettings();
        const amountPkr = toPkr(
          input.amount,
          input.currency,
          settings.exchangeRatePkrPerUsd
        );
        const activePackage = Boolean(await getActivePackageForUser(user.id));
        const hasPendingChannelReward =
          profile.whatsappRewardEligible &&
          profile.whatsappBonusClaimed &&
          !profile.whatsappRewardWithdrawn;
        if (
          !activePackage &&
          hasPendingChannelReward &&
          amountPkr !== WHATSAPP_JOIN_REWARD_PKR
        )
          fail(WITHDRAWAL_NO_PACKAGE_MESSAGE);
        const withdrawalError = validateWithdrawalRequest({
          balancePkr: profile.balancePkr,
          withdrawalLimitPkr: profile.withdrawalLimitPkr,
          amountPkr,
          activePackage: activePackage || hasPendingChannelReward,
          freeWithdrawalCompleted:
            profile.whatsappRewardEligible && profile.whatsappRewardWithdrawn,
          allowChannelRewardAmount: hasPendingChannelReward,
        });
        if (withdrawalError) fail(withdrawalError);
        if (
          !["JazzCash", "Easypaisa", "SadaPay", "NayaPay", "Skrill", "Payoneer", "Binance", "Other"].includes(input.walletType)
        )
          fail(WITHDRAWAL_WALLET_TYPE_MESSAGE);
        if (!input.accountName) fail(WITHDRAWAL_ACCOUNT_NAME_MESSAGE);
        if (!input.accountDetails) fail(WITHDRAWAL_WALLET_NUMBER_MESSAGE);
        if (
          input.currency === "PKR" &&
          !isValidPakistanMobileNumber(input.accountDetails)
        )
          fail(WITHDRAWAL_WALLET_NUMBER_MESSAGE);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const result = await db.insert(withdrawals).values({
          userId: user.id,
          currency: input.currency,
          amountPkr,
          walletType: input.walletType,
          accountName: input.accountName,
          accountDetails: input.accountDetails,
          status: "pending",
        });
        const withdrawalId = Number(result[0].insertId);
        const reserved = applyWithdrawalRequest(profile.balancePkr, amountPkr);
        const completedChannelRewardWithdrawal =
          hasPendingChannelReward && amountPkr === WHATSAPP_JOIN_REWARD_PKR;
        await db
          .update(profiles)
          .set({
            balancePkr: reserved.balancePkr,
            withdrawalLimitPkr: reserved.withdrawalLimitPkr,
            ...(completedChannelRewardWithdrawal
              ? { whatsappRewardWithdrawn: true }
              : {}),
          })
          .where(eq(profiles.userId, user.id));
        await db.insert(transactions).values({
          userId: user.id,
          type: "withdrawal",
          direction: "debit",
          amountPkr,
          status: "pending",
          note: "Withdrawal request awaiting approval; wallet amount reserved",
          referenceType: "withdrawal",
          referenceId: withdrawalId,
        });
        void sendTelegramAlert(
          [
            "💸 WITHDRAW REQUEST",
            `👤 User: ${profile.username}`,
            `💵 Amount: ${input.amount} ${input.currency}`,
            `📱 ${input.walletType}: ${input.accountName} · ${input.accountDetails}`,
          ].join("\n")
        );
        return { success: true };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.userId, user.id))
        .orderBy(desc(withdrawals.createdAt));
    }),
  }),
  referral: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const referrals = await db
        .select({
          userId: profiles.userId,
          username: profiles.username,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(eq(profiles.referredByUserId, user.id));
      const purchaserRows = referrals.length
        ? await db
            .select({ userId: userPackages.userId })
            .from(userPackages)
            .where(
              inArray(
                userPackages.userId,
                referrals.map(referral => referral.userId)
              )
            )
        : [];
      const purchasers = new Set(purchaserRows.map(row => row.userId));
      return {
        username: profile.username,
        referralCode: profile.referralCode,
        totalReferrals: referrals.length,
        purchasedReferrals: purchasers.size,
        withdrawalLimitPkr: profile.withdrawalLimitPkr,
        referrals,
      };
    }),
  }),
  support: router({
    create: protectedProcedure
      .input(
        z.object({
          subject: z.string().trim().min(3).max(140),
          description: z.string().trim().min(10).max(5000),
          screenshotData: z.string().max(2_000_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const screenshotData = input.screenshotData
          ? validateInlineUpload(input.screenshotData, {
              label: "screenshot",
              maxBytes: 1 * 1024 * 1024,
              acceptedType: contentType => contentType.startsWith("image/"),
            })
          : null;
        await db.insert(supportTickets).values({
          userId: user.id,
          subject: input.subject,
          description: input.description,
          screenshotUrl: null,
          screenshotKey: null,
          screenshotData,
          status: "open",
        });
        void sendTelegramAlert(
          [
            "🆘 SUPPORT",
            `👤 User: ${profile.username}`,
            `❓ Msg: ${input.description}`,
            `📧 Email: ${user.email ?? "Not provided"}`,
          ].join("\n")
        );
        return { success: true };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, user.id))
        .orderBy(desc(supportTickets.updatedAt));
    }),
  }),
  admin: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [pendingDeposits, pendingWithdrawals, openTickets, userCount] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(deposits)
            .where(eq(deposits.status, "pending")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(withdrawals)
            .where(eq(withdrawals.status, "pending")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(supportTickets)
            .where(sql`${supportTickets.status} != 'resolved'`),
          db.select({ count: sql<number>`count(*)` }).from(profiles),
        ]);
      return {
        pendingDeposits: Number(pendingDeposits[0]?.count ?? 0),
        pendingWithdrawals: Number(pendingWithdrawals[0]?.count ?? 0),
        openTickets: Number(openTickets[0]?.count ?? 0),
        userCount: Number(userCount[0]?.count ?? 0),
      };
    }),
    financialRequests: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [depositRows, withdrawalRows, memberRows, packageRows, referralRows, activePackageRows] =
        await Promise.all([
          db.select().from(deposits).orderBy(desc(deposits.createdAt)),
          db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)),
          db
            .select({
              userId: users.id,
              email: users.email,
              username: profiles.username,
              balancePkr: profiles.balancePkr,
              withdrawalLimitPkr: profiles.withdrawalLimitPkr,
            })
            .from(users)
            .innerJoin(profiles, eq(users.id, profiles.userId)),
          db.select({ id: packages.id, name: packages.name }).from(packages),
          db.select({ referredByUserId: profiles.referredByUserId }).from(profiles),
          db
            .select({ userId: userPackages.userId, packageName: packages.name })
            .from(userPackages)
            .innerJoin(packages, eq(userPackages.packageId, packages.id))
            .where(sql`${userPackages.expiresAt} > NOW()`),
        ]);
      const activePackageNames = new Map(
        activePackageRows.map(row => [row.userId, row.packageName])
      );
      const members = new Map(
        memberRows.map(member => [
          member.userId,
          { ...member, activePackageName: activePackageNames.get(member.userId) ?? null },
        ])
      );
      const packageNames = new Map(packageRows.map(plan => [plan.id, plan.name]));
      const referralCounts = new Map<number, number>();
      referralRows.forEach(row => {
        if (row.referredByUserId)
          referralCounts.set(
            row.referredByUserId,
            (referralCounts.get(row.referredByUserId) ?? 0) + 1
          );
      });
      const approvedVisibilityCutoff = Date.now() - 60 * 60 * 1000;
      const remainsVisibleInActiveRequests = (row: { status: string; reviewedAt: Date | null }) =>
        row.status !== "approved" ||
        !row.reviewedAt ||
        row.reviewedAt.getTime() > approvedVisibilityCutoff;
      return {
        deposits: depositRows.filter(remainsVisibleInActiveRequests).map(row => ({
          ...row,
          member: members.get(row.userId) ?? null,
          requestedPackageName: row.requestedPackageId
            ? packageNames.get(row.requestedPackageId) ?? null
            : null,
        })),
        withdrawals: withdrawalRows.filter(remainsVisibleInActiveRequests).map(row => ({
          ...row,
          member: members.get(row.userId)
            ? {
                ...members.get(row.userId),
                referralCount: referralCounts.get(row.userId) ?? 0,
              }
            : null,
        })),
      };
    }),
    reviewDeposit: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          approved: z.boolean(),
          note: z.string().trim().max(512).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const deposit = (
          await db
            .select()
            .from(deposits)
            .where(eq(deposits.id, input.id))
            .limit(1)
        )[0];
        if (!deposit) fail("Deposit request was not found.", "NOT_FOUND");
        if (deposit.status !== "pending")
          fail("This deposit request has already been reviewed.");
        const status = input.approved ? "approved" : "rejected";
        await db
          .update(deposits)
          .set({
            status,
            adminNote: input.note ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(deposits.id, deposit.id));
        await db
          .update(transactions)
          .set({ status: input.approved ? "approved" : "rejected" })
          .where(
            and(
              eq(transactions.referenceType, "deposit"),
              eq(transactions.referenceId, deposit.id),
              eq(transactions.status, "pending")
            )
          );
        if (input.approved) {
          const profile = (
            await db
              .select()
              .from(profiles)
              .where(eq(profiles.userId, deposit.userId))
              .limit(1)
          )[0];
          if (profile)
            await db
              .update(profiles)
              .set({ balancePkr: profile.balancePkr + deposit.amountPkr })
              .where(eq(profiles.userId, deposit.userId));
        }
        return { success: true };
      }),
    reviewWithdrawal: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          approved: z.boolean(),
          note: z.string().trim().max(512).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const request = (
          await db
            .select()
            .from(withdrawals)
            .where(eq(withdrawals.id, input.id))
            .limit(1)
        )[0];
        if (!request) fail("Withdrawal request was not found.", "NOT_FOUND");
        if (request.status !== "pending")
          fail("This withdrawal request has already been reviewed.");
        const profile = (
          await db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, request.userId))
            .limit(1)
        )[0];
        if (!profile) fail("The user's profile was not found.", "NOT_FOUND");
        if (!input.approved) {
          const refundedBalance = refundRejectedWithdrawal(
            profile.balancePkr,
            request.amountPkr
          );
          await db
            .update(profiles)
            .set({
              balancePkr: refundedBalance,
              withdrawalLimitPkr:
                profile.withdrawalLimitPkr + request.amountPkr,
            })
            .where(eq(profiles.userId, request.userId));
        }
        await db
          .update(withdrawals)
          .set({
            status: input.approved ? "approved" : "rejected",
            adminNote: input.note ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(withdrawals.id, request.id));
        if (
          input.approved &&
          profile.whatsappRewardEligible &&
          profile.whatsappBonusClaimed &&
          !profile.whatsappRewardWithdrawn &&
          request.amountPkr >= WHATSAPP_JOIN_REWARD_PKR
        )
          await db
            .update(profiles)
            .set({ whatsappRewardWithdrawn: true })
            .where(eq(profiles.userId, request.userId));
        await db
          .update(transactions)
          .set({
            status: input.approved ? "approved" : "rejected",
            direction: input.approved ? "debit" : "neutral",
          })
          .where(
            and(
              eq(transactions.referenceType, "withdrawal"),
              eq(transactions.referenceId, request.id),
              eq(transactions.status, "pending")
            )
          );
        return { success: true };
      }),
    deleteDepositHistory: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const record = (
          await db.select().from(deposits).where(eq(deposits.id, input.id)).limit(1)
        )[0];
        if (!record) fail("Deposit history record was not found.", "NOT_FOUND");
        if (record.status === "pending")
          fail("Review this deposit before deleting its history.", "CONFLICT");
        await db.delete(deposits).where(eq(deposits.id, record.id));
        return { success: true };
      }),
    deleteWithdrawalHistory: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const record = (
          await db.select().from(withdrawals).where(eq(withdrawals.id, input.id)).limit(1)
        )[0];
        if (!record) fail("Withdrawal history record was not found.", "NOT_FOUND");
        if (record.status === "pending")
          fail("Review this withdrawal before deleting its history.", "CONFLICT");
        await db.delete(withdrawals).where(eq(withdrawals.id, record.id));
        return { success: true };
      }),
    users: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          profile: profiles,
        })
        .from(users)
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .orderBy(desc(users.createdAt));
    }),
    userDetail: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const member = (
          await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              createdAt: users.createdAt,
              hasPassword: sql<number>`case when ${users.passwordHash} is null then 0 else 1 end`,
              profile: profiles,
            })
            .from(users)
            .innerJoin(profiles, eq(users.id, profiles.userId))
            .where(eq(users.id, input.userId))
            .limit(1)
        )[0];
        if (!member) fail("Member was not found.", "NOT_FOUND");
        const [memberDeposits, memberWithdrawals, memberTransactions, referrals] =
          await Promise.all([
            db
              .select()
              .from(deposits)
              .where(eq(deposits.userId, input.userId))
              .orderBy(desc(deposits.createdAt)),
            db
              .select()
              .from(withdrawals)
              .where(eq(withdrawals.userId, input.userId))
              .orderBy(desc(withdrawals.createdAt)),
            db
              .select()
              .from(transactions)
              .where(eq(transactions.userId, input.userId))
              .orderBy(desc(transactions.createdAt)),
            db
              .select({ count: sql<number>`count(*)` })
              .from(profiles)
              .where(eq(profiles.referredByUserId, input.userId)),
          ]);
        const activePackage = await getActivePackageForUser(input.userId);
        return {
          member: {
            ...member,
            passwordStatus: Number(member.hasPassword) ? "set" : "not_set",
            hasPassword: undefined,
          },
          totals: {
            depositAmountPkr: memberDeposits
              .filter(row => row.status === "approved")
              .reduce((sum, row) => sum + row.amountPkr, 0),
            depositCount: memberDeposits.length,
            withdrawalAmountPkr: memberWithdrawals
              .filter(row => row.status === "approved")
              .reduce((sum, row) => sum + row.amountPkr, 0),
            withdrawalCount: memberWithdrawals.length,
            referralCount: Number(referrals[0]?.count ?? 0),
          },
          activePackage: activePackage
            ? { name: activePackage.plan.name, expiresAt: activePackage.ownership.expiresAt }
            : null,
          deposits: memberDeposits,
          withdrawals: memberWithdrawals,
          referralEarnings: memberTransactions.filter(
            row => row.type === "referral_limit"
          ),
        };
      }),
    setBlocked: protectedProcedure
      .input(
        z.object({ userId: z.number().int().positive(), blocked: z.boolean() })
      )
      .mutation(async ({ ctx, input }) => {
        const { user } = await getAdmin(ctx);
        if (input.userId === user.id)
          fail("The designated administrator cannot be blocked.");
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .update(profiles)
          .set({ isBlocked: input.blocked })
          .where(eq(profiles.userId, input.userId));
        return { success: true };
      }),
    ads: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(ads).orderBy(desc(ads.updatedAt));
    }),
    saveAd: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          packageTier: z.string().min(3).max(24),
          title: z.string().trim().min(3).max(128),
          contentType: z.enum(["text", "image", "video", "link", "app"]),
          content: z.string().trim().max(5000).optional(),
          mediaData: z.string().max(8_000_000).optional(),
          targetUrl: z.string().url().optional(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        if (!input.id && input.contentType === "text")
          fail("New advertisements must use Image, Video, Link, or App Ad.");
        const content = input.content ?? "";
        let mediaData: string | null | undefined =
          input.contentType === "image" || input.contentType === "video"
            ? undefined
            : null;
        if (input.mediaData) {
          if (input.contentType !== "image" && input.contentType !== "video")
            fail("Only image or video ad types accept gallery uploads.");
          mediaData = saveAdMedia(input.mediaData, input.contentType);
        }
        if (
          (input.contentType === "image" || input.contentType === "video") &&
          !mediaData &&
          !input.id
        )
          fail("Please upload media for this ad type.");
        if (
          (input.contentType === "link" || input.contentType === "app") &&
          !input.targetUrl
        )
          fail("Please paste a destination link for this ad type.");
        const values = {
          packageTier: input.packageTier,
          title: input.title,
          contentType: input.contentType,
          content: content || input.targetUrl || "Custom advertisement",
          mediaData,
          targetUrl: input.targetUrl ?? null,
          isActive: input.isActive,
        };
        if (input.id) {
          await db.update(ads).set(values).where(eq(ads.id, input.id));
        } else {
          await db.insert(ads).values(values);
        }
        return { success: true };
      }),
    deleteAd: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db.delete(ads).where(eq(ads.id, input.id));
        return { success: true };
      }),
    paymentAccounts: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select()
        .from(paymentAccounts)
        .orderBy(paymentAccounts.currency, paymentAccounts.provider);
    }),
    savePaymentAccount: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          currency: z.enum(["PKR", "USD"]),
          provider: z.string().trim().min(2).max(64),
          accountName: z.string().trim().min(2).max(128),
          accountDetails: z.string().trim().min(3).max(256),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const paymentAccountValues = {
          ...input,
          currencyType: input.currency,
        };
        if (input.id)
          await db
            .update(paymentAccounts)
            .set(paymentAccountValues)
            .where(eq(paymentAccounts.id, input.id));
        else await db.insert(paymentAccounts).values(paymentAccountValues);
        return { success: true };
      }),
    deletePaymentAccount: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .delete(paymentAccounts)
          .where(eq(paymentAccounts.id, input.id));
        return { success: true };
      }),
    broadcasts: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt));
    }),
    createBroadcast: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(3).max(140),
          body: z.string().trim().min(3).max(5000),
          mediaUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .insert(broadcasts)
          .values({ ...input, mediaUrl: input.mediaUrl ?? null });
        return { success: true };
      }),
    tickets: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db
        .select()
        .from(supportTickets)
        .orderBy(desc(supportTickets.updatedAt));
    }),
    respondTicket: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["open", "in_review", "resolved"]),
          response: z.string().trim().max(5000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .update(supportTickets)
          .set({
            status: input.status,
            adminResponse: input.response ?? null,
            respondedAt: input.response ? new Date() : null,
          })
          .where(eq(supportTickets.id, input.id));
        return { success: true };
      }),
    settings: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      return getSettings();
    }),
    saveSettings: protectedProcedure
      .input(
        z.object({
          exchangeRatePkrPerUsd: z.number().int().min(1),
          adTimerSeconds: z.number().int().min(5).max(600),
          referralCommissionPercent: z.number().int().min(0).max(100),
          websiteName: z.string().trim().min(2).max(80),
          themeName: z.enum(["green", "blue", "dark", "white", "black", "red", "yellow"]),
          buttonColor: z.enum(["amber", "white", "black", "red", "green", "yellow", "blue", "purple", "pink", "orange", "teal"]).default("amber"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .update(appSettings)
          .set({
            ...input,
            minimumWithdrawalPkr: 0,
            maximumWithdrawalPkr: 3000,
          })
          .where(eq(appSettings.id, 1));
        return { success: true };
      }),
    euroSettings: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const settings = await getSettings();
      return {
        euroBonusPkr: settings.euroBonusPkr,
        euroAviatorEnabled: settings.euroAviatorEnabled,
        euroMinimumBetPkr: settings.euroMinimumBetPkr,
        euroMaximumBetPkr: settings.euroMaximumBetPkr,
        euroCrashBandWeights: settings.euroCrashBandWeights,
      };
    }),
    saveEuroSettings: protectedProcedure
      .input(
        z.object({
          euroBonusPkr: z.number().int().min(100).max(150),
          euroAviatorEnabled: z.boolean(),
          euroMinimumBetPkr: z.number().int().min(16).max(20_000),
          euroMaximumBetPkr: z.number().int().min(16).max(20_000),
          euroCrashBandWeights: z.string().trim().max(64),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        if (input.euroMinimumBetPkr > input.euroMaximumBetPkr)
          fail("Euro minimum bet cannot be greater than the maximum bet.");
        try {
          parseCrashBandWeights(input.euroCrashBandWeights);
        } catch (error) {
          fail(error instanceof Error ? error.message : "Invalid crash-band weights.");
        }
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db
          .update(appSettings)
          .set(input)
          .where(eq(appSettings.id, 1));
        return { success: true };
      }),
    gameTasks: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(gameTasks).orderBy(desc(gameTasks.updatedAt));
    }),
    saveGameTask: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          title: z.string().trim().min(3).max(140),
          targetUrl: z.string().url(),
          imageData: z.string().max(2_000_000).optional(),
          rewardPkr: z.number().int().min(1).max(10_000),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const imageData = input.imageData
          ? validateInlineUpload(input.imageData, {
              label: "game-task image",
              maxBytes: 1 * 1024 * 1024,
              acceptedType: mimeType => mimeType.startsWith("image/"),
            })
          : null;
        const values = {
          title: input.title,
          targetUrl: input.targetUrl,
          imageData,
          rewardPkr: input.rewardPkr,
          isActive: input.isActive,
        };
        if (input.id)
          await db.update(gameTasks).set(values).where(eq(gameTasks.id, input.id));
        else await db.insert(gameTasks).values(values);
        return { success: true };
      }),
    deleteGameTask: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db.delete(gameTasks).where(eq(gameTasks.id, input.id));
        return { success: true };
      }),
    saveBrandLogo: protectedProcedure
      .input(z.object({ logoData: z.string().trim().min(1).max(2_000_000) }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const logoData = validateDirectBrandLogo(input.logoData);
        await db
          .update(appSettings)
          .set({ logoData, logoUrl: null, logoKey: null })
          .where(eq(appSettings.id, 1));
        return { success: true, logoUrl: logoData };
      }),
  }),
});

export type AppRouter = typeof appRouter;
