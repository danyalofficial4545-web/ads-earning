import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  adSessions,
  ads,
  appSettings,
  authChallenges,
  broadcasts,
  deposits,
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
} from "./rules";
import {
  getDailyAdQuota,
  getDailyAdStates,
  getNextPakistanMidnight,
} from "../shared/adRules";

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
  return {
    profile,
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
            .email("Please correct your Email / Gmail")
            .max(320),
          password: z
            .string()
            .min(8, "Please correct your Password")
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
          fail("An account already exists for this email address.", "CONFLICT");
        if (usernameMatch[0])
          fail("That username is already in use.", "CONFLICT");
        if (deviceMatch[0] || networkMatch[0])
          fail("Only one account per device or network is allowed.", "FORBIDDEN");
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
            .email("Please correct your Email / Gmail")
            .max(320),
          password: z.string().min(8, "Please correct your Password"),
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
            .min(3, "Please enter correct Transaction ID")
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
          amount: z.number().positive("Please enter a valid amount"),
          accountName: z.string().trim().min(2).max(128),
          accountDetails: z
            .string()
            .trim()
            .min(4, "Please enter correct JazzCash number linked with account")
            .max(512),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { user, profile } = await getActor(ctx);
        if (
          input.currency === "PKR" &&
          !isValidPakistanMobileNumber(input.accountDetails)
        )
          fail("Please enter correct JazzCash number linked with account");
        const settings = await getSettings();
        const amountPkr = toPkr(
          input.amount,
          input.currency,
          settings.exchangeRatePkrPerUsd
        );
        const activePackage = Boolean(await getActivePackageForUser(user.id));
        const withdrawalError = validateWithdrawalRequest({
          balancePkr: profile.balancePkr,
          withdrawalLimitPkr: profile.withdrawalLimitPkr,
          amountPkr,
          activePackage,
        });
        if (withdrawalError) fail(withdrawalError);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const result = await db.insert(withdrawals).values({
          userId: user.id,
          currency: input.currency,
          amountPkr,
          accountName: input.accountName,
          accountDetails: input.accountDetails,
          status: "pending",
        });
        const withdrawalId = Number(result[0].insertId);
        const reserved = applyWithdrawalRequest(profile.balancePkr, amountPkr);
        await db
          .update(profiles)
          .set({
            balancePkr: reserved.balancePkr,
            withdrawalLimitPkr: reserved.withdrawalLimitPkr,
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
            `📱 Easypaisa/JazzCash: ${input.accountDetails}`,
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
      return {
        deposits: depositRows.map(row => ({
          ...row,
          member: members.get(row.userId) ?? null,
          requestedPackageName: row.requestedPackageId
            ? packageNames.get(row.requestedPackageId) ?? null
            : null,
        })),
        withdrawals: withdrawalRows.map(row => ({
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
        if (input.id)
          await db
            .update(paymentAccounts)
            .set(input)
            .where(eq(paymentAccounts.id, input.id));
        else await db.insert(paymentAccounts).values(input);
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
