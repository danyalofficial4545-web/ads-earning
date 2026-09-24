import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  adSessions,
  appSettings,
  broadcasts,
  notifications,
  supportReplyRules,
  deposits,
  packages,
  paymentAccounts,
  profiles,
  referrals,
  referralTaskRewards,
  timewallPostbacks,
  tasks,
  taskProofs,
  supportTickets,
  supportChatMessages,
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
import { clientIpFromHeaders, hashSecurityValue } from "./security";
import { sendTelegramAlert } from "./telegram";
import { invokeLLM } from "./_core/llm";
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
  AD_TIMER_MESSAGE,
  AD_RETRY_MESSAGE,
  applyWithdrawalRequest,
  canUseMemberWorkspace,
  fromPkr,
  getAdClaimStatus,
  isValidPakistanMobileNumber,
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
  REWARDED_AD_TIMER_SECONDS,
} from "./rules";
import { getDailyAdRewardPkr,
  getDailyAdQuota,
  getNextPakistanMidnight,
} from "../shared/adRules";
import { ENV } from "./_core/env";

function fail(message: string, code: TRPCError["code"] = "BAD_REQUEST"): never {
  throw new TRPCError({ code, message });
}

const credentialInput = z.object({
  email: z.string().trim().max(320).optional(),
  gmail: z.string().trim().optional(),
  password: z.string().min(6, "Password must be at least 6 characters.").max(128),
}).transform(({ email, gmail, ...rest }) => ({
  ...rest,
  email: (email ?? gmail ?? "").trim(),
})).refine(input => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email), {
  path: ["email"],
  message: "Please enter a valid email address.",
});

async function notifyUser(db: any, userId: number, title: string, message: string) {
  if (typeof db?.insert !== "function") return;
  await db.insert(notifications).values({ userId, title, message, isRead: false });
}

async function withDbTransaction<T>(db: any, work: (tx: any) => Promise<T>) {
  return typeof db?.transaction === "function" ? db.transaction(work) : work(db);
}

async function ensureReferralRecord(db: any, referrerId: number | null, referredId: number) {
  if (!referrerId || referrerId === referredId) return;
  const existing = await db.select({ id: referrals.id }).from(referrals).where(eq(referrals.referredId, referredId)).limit(1);
  if (!existing[0]) await db.insert(referrals).values({ referrerId, referredId });
}

async function awardTaskReferralReward(db: any, referredId: number, taskId: number) {
  const relation = (await db.select().from(referrals).where(eq(referrals.referredId, referredId)).limit(1))[0];
  if (!relation || relation.totalTasksRewarded >= relation.maxTaskReward) return;
  const alreadyRewarded = (await db.select({ id: referralTaskRewards.id }).from(referralTaskRewards).where(and(eq(referralTaskRewards.referredId, referredId), eq(referralTaskRewards.taskId, taskId))).limit(1))[0];
  if (alreadyRewarded) return;
  const referrer = (await db.select().from(profiles).where(eq(profiles.userId, relation.referrerId)).limit(1))[0];
  if (!referrer) return;
  const rewardCoins = 100;
  await db.update(profiles).set({ earningWalletBalance: (referrer.earningWalletBalance ?? 0) + rewardCoins }).where(eq(profiles.userId, relation.referrerId));
  await db.update(referrals).set({ totalTasksRewarded: relation.totalTasksRewarded + 1, totalTaskEarnings: relation.totalTaskEarnings + rewardCoins }).where(eq(referrals.id, relation.id));
  await db.insert(referralTaskRewards).values({ referrerId: relation.referrerId, referredId, taskId, rewardCoins });
  await db.insert(transactions).values({ userId: relation.referrerId, type: "referral_task_reward", direction: "credit", amountPkr: 1, status: "completed", note: "Referral Task Reward: 1 PKR from referred user task", referenceType: "referral_task_reward", referenceId: String(taskId) });
}

export async function processTimewallPostback(input: {
  userId: string;
  coins: string;
  secret: string;
  transactionId: string;
}): Promise<{ status: number; body: string }> {
  if (input.secret !== ENV.timewallPostbackSecret) return { status: 403, body: "FORBIDDEN" };
  const userId = Number(input.userId);
  const coinsReceived = Number(input.coins);
  const transactionId = input.transactionId.trim();
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(coinsReceived) || coinsReceived <= 0 || !transactionId || transactionId.length > 160)
    return { status: 400, body: "INVALID" };
  const db = await getDb();
  if (!db) return { status: 503, body: "UNAVAILABLE" };
  const duplicate = (await db.select({ id: timewallPostbacks.id }).from(timewallPostbacks).where(eq(timewallPostbacks.transactionId, transactionId)).limit(1))[0];
  if (duplicate) return { status: 200, body: "OK" };
  const coinsGivenToUser = Math.floor(coinsReceived * 0.10);
  if (coinsGivenToUser <= 0) return { status: 400, body: "INVALID" };
  await withDbTransaction(db, async tx => {
    const duplicateInside = (await tx.select({ id: timewallPostbacks.id }).from(timewallPostbacks).where(eq(timewallPostbacks.transactionId, transactionId)).limit(1))[0];
    if (duplicateInside) return;
    const profile = (await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0];
    if (!profile) fail("User was not found.", "NOT_FOUND");
    await tx.insert(timewallPostbacks).values({ userId, coinsReceived, coinsGivenToUser, transactionId });
    await tx.update(profiles).set({ earningWalletBalance: (profile.earningWalletBalance ?? 0) + coinsGivenToUser }).where(eq(profiles.userId, userId));
    await tx.insert(transactions).values({ userId, type: "timewall_earning", direction: "credit", amountPkr: Math.floor(coinsGivenToUser / 100), status: "completed", note: `Timewall earning: ${coinsGivenToUser} coins (10% of ${coinsReceived})`, referenceType: "timewall_postback", referenceId: transactionId });
    const relation = (await tx.select().from(referrals).where(eq(referrals.referredId, userId)).limit(1))[0];
    if (relation && relation.totalTasksRewarded < relation.maxTaskReward) {
      const referrer = (await tx.select().from(profiles).where(eq(profiles.userId, relation.referrerId)).limit(1))[0];
      if (referrer) {
        await tx.update(profiles).set({ earningWalletBalance: (referrer.earningWalletBalance ?? 0) + 100 }).where(eq(profiles.userId, relation.referrerId));
        await tx.update(referrals).set({ totalTasksRewarded: relation.totalTasksRewarded + 1, totalTaskEarnings: relation.totalTaskEarnings + 100 }).where(eq(referrals.id, relation.id));
        await tx.insert(referralTaskRewards).values({ referrerId: relation.referrerId, referredId: userId, taskId: null, rewardCoins: 100 });
        await tx.insert(transactions).values({ userId: relation.referrerId, type: "referral_task_reward", direction: "credit", amountPkr: 1, status: "completed", note: "Referral Task Reward: 1 PKR from Timewall completion", referenceType: "timewall_postback", referenceId: transactionId });
      }
    }
  });
  return { status: 200, body: "OK" };
}

const SUPPORT_KNOWLEDGE_BASE = `You are AdEarn AI Support. Answer in the user's language, usually Urdu/Roman Urdu. Be concise, respectful, and never promise admin approval or guaranteed earnings. Knowledge base:
- Withdrawal issue: Explain that the member should have an active package and eligible withdrawal limit; referral credits are handled by the platform according to its rules. Ask for username when account checking is needed.
- Deposit issue: Ask for username and transaction ID. If sent through Easypaisa/JazzCash, advise waiting 5-10 minutes while the admin reviews it. Tell them to copy the transaction ID using the copy button.
- Package help: Check wallet balance. If it covers the package price, use Buy directly; if short, deposit the displayed shortfall, then buy.
- Ads help: Buy an active package first, open Ads/Tasks, watch the package-entitled five-second ads, and claim the reward after the timer.
If the question needs account access or approval, say that an administrator can review it and ask for the username and relevant transaction ID. Do not invent account balances, approvals, or transaction status.`;

const supportFallback = (message: string) => {
  const text = message.toLowerCase();
  if (text.includes("withdraw") || text.includes("ودڈرا") || text.includes("invite") || text.includes("انوا"))
    return "اپنا یوزرنیم بھیج دیں۔ Withdrawal کے لیے active package اور eligible withdrawal limit ضروری ہے۔ اگر account check چاہیے تو اپنا username اور متعلقہ تفصیل بھیجیں۔";
  if (text.includes("deposit") || text.includes("ڈیپازٹ") || text.includes("transaction") || text.includes("trx") || text.includes("tid"))
    return "براہِ کرم اپنا username اور Transaction ID بھیجیں۔ Easypaisa/JazzCash سے payment کے بعد 5–10 منٹ انتظار کریں؛ Transaction ID copy button سے copy کر کے یہاں بھیج سکتے ہیں۔";
  if (text.includes("package") || text.includes("پیکیج") || text.includes("buy") || text.includes("خرید"))
    return "Wallet میں balance چیک کریں۔ اگر balance package price کے برابر ہو تو Buy پر click کریں۔ اگر کم ہو تو جتنا shortfall دکھایا جائے اتنا deposit کر کے package خریدیں۔";
  if (text.includes("ad") || text.includes("ads") || text.includes("اشتہار") || text.includes("watch"))
    return "پہلے active package خریدیں، پھر Ads/Tasks page کھولیں۔ آپ کے package کے مطابق ads دکھیں گے؛ ہر ad پانچ سیکنڈ دیکھ کر reward claim کریں۔";
  return "میں آپ کی مدد کے لیے حاضر ہوں۔ اپنا سوال واضح لکھیں یا نیچے موجود quick reply منتخب کریں۔ Account check کے لیے اپنا username اور متعلقہ Transaction ID بھیج دیں۔";
};

const contentToText = (content: unknown) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((part: any) => part?.type === "text").map((part: any) => part.text).join(" ").trim();
  return "";
};

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
  const rewardWithdrawalHistory = await db
    .select({ id: withdrawals.id })
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.userId, userId),
        eq(withdrawals.currency, "PKR"),
        eq(withdrawals.amountPkr, WHATSAPP_JOIN_REWARD_PKR)
      )
    )
    .limit(1);
  const rewardWithdrawalRequested =
    profile.whatsappRewardWithdrawn || rewardWithdrawalHistory.length > 0;
  const rewardProfile = rewardWithdrawalRequested && !profile.whatsappRewardWithdrawn
    ? { ...profile, whatsappRewardWithdrawn: true }
    : profile;
  const hasPendingChannelReward =
    rewardProfile.whatsappRewardEligible &&
    rewardProfile.whatsappBonusClaimed &&
    !rewardProfile.whatsappRewardWithdrawn;
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
  const totalDeposits = await db
    .select({ total: sql<number>`coalesce(sum(${deposits.amountPkr}), 0)` })
    .from(deposits)
    .where(
      and(
        eq(deposits.userId, userId),
        eq(deposits.status, "approved")
      )
    );
  const totalWithdrawals = await db
    .select({ total: sql<number>`coalesce(sum(${withdrawals.amountPkr}), 0)` })
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.userId, userId),
        eq(withdrawals.status, "approved")
      )
    );
  const totalAdsWatched = await db
    .select({ count: sql<number>`count(*)` })
    .from(adSessions)
    .where(
      and(
        eq(adSessions.userId, userId),
        sql`${adSessions.claimedAt} IS NOT NULL`
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
  const dailyQuota = activePackage
    ? getDailyAdQuota(activePackage.plan.pricePkr)
    : 0;
  const visibleProfile = activePackage || hasPendingChannelReward
    ? rewardProfile
    : { ...rewardProfile, withdrawalLimitPkr: 0 };
  return {
    profile: visibleProfile,
    rewardWithdrawalRequested,
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
      total: dailyQuota,
      resetAt: getNextPakistanMidnight(),
    },
    totalEarnedPkr: Number(totalEarned[0]?.total ?? 0),
    totalDepositsPkr: Number(totalDeposits[0]?.total ?? 0),
    totalWithdrawalsPkr: Number(totalWithdrawals[0]?.total ?? 0),
    totalAdsWatched: Number(totalAdsWatched[0]?.count ?? 0),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user ? publicUser(opts.ctx.user) : null
    ),
    register: publicProcedure
      .input(
        credentialInput.and(z.object({
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
          deviceId: z.string().trim().min(16).max(256),
        }))
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const email = input.email.toLowerCase();
        const username = input.username.toLowerCase();
        const deviceFingerprintHash = hashSecurityValue(input.deviceId);
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
          depositWalletBalance: 0,
          earningWalletBalance: 0,
          withdrawalLimitPkr: 0,
          preferredCurrency: "PKR",
          whatsappRewardEligible: true,
        });
        await ensureReferralRecord(db, referredByUserId, userId);
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
      .input(credentialInput)
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
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
            .min(6, "Password must be at least 6 characters.")
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
        await ensureReferralRecord(db, referredByUserId, user.id);
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
      const activePackages = (
        await db
          .select()
          .from(packages)
          .where(eq(packages.isActive, true))
      ).sort((a, b) => a.pricePkr - b.pricePkr);
      return {
        packages: activePackages,
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
        .where(eq(broadcasts.isActive, true))
        .orderBy(desc(broadcasts.createdAt))
        .limit(10);
    }),
    notifications: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
    }),
    unreadNotifications: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const rows = await db.select().from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))).orderBy(desc(notifications.createdAt));
      return { count: rows.length, rows };
    }),
    markNotificationRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.id), eq(notifications.userId, user.id)));
      return { success: true };
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
          earningWalletBalance:
            (profile.earningWalletBalance ?? 0) + WHATSAPP_JOIN_REWARD_PKR * 100,
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
        referenceId: String(user.id),
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
      return (
        await db.select().from(packages).where(eq(packages.isActive, true))
      ).sort((a, b) => a.pricePkr - b.pricePkr);
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
        const purchasePriceCoins = plan.priceCoins ?? plan.pricePkr * 100;
        if ((profile.depositWalletBalance ?? 0) < purchasePriceCoins)
          fail(
            "Your Deposit Wallet balance is insufficient. Please deposit funds first."
          );
        const now = new Date();
        const expiresAt = new Date(
          plan.durationDays === 0
            ? new Date("2099-12-31T23:59:59.999Z").getTime()
            : now.getTime() + plan.durationDays * 86_400_000
        );
        await db
          .update(profiles)
          .set({
            depositWalletBalance: (profile.depositWalletBalance ?? 0) - purchasePriceCoins,
            activePackageId: plan.id,
            packageExpiryDate: expiresAt,
          })
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
          note: `${plan.name} package purchased from Deposit Wallet (${purchasePriceCoins} coins)`,
        });
        // Wallet purchase - no referral commission - company loss fix
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
          (data.profile.earningWalletBalance ?? 0) / 100,
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
              "bonus",
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
  timewall: router({
    config: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      return {
        userId: user.id,
        earningWalletBalance: profile.earningWalletBalance ?? 0,
        wallId: ENV.timewallWallId,
        hasActivePackage: Boolean(await getActivePackageForUser(user.id)),
      };
    }),
    postback: publicProcedure
      .input(z.object({ userId: z.coerce.string(), coins: z.coerce.string(), secret: z.string(), transactionId: z.string() }))
      .query(({ input }) => processTimewallPostback(input)),
  }),
  task: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(tasks).where(eq(tasks.isActive, true)).orderBy(desc(tasks.createdAt));
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const task = (await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1))[0];
      if (!task) fail("Task was not found.", "NOT_FOUND");
      return task;
    }),
    submitProof: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), gameUserId: z.string().trim().min(2).max(160), screenshotData: z.string().min(24).max(3_000_000) })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const task = (await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.isActive, true))).limit(1))[0];
      if (!task) fail("This task is no longer available.", "NOT_FOUND");
      const pending = (await db.select({ id: taskProofs.id }).from(taskProofs).where(and(eq(taskProofs.userId, user.id), eq(taskProofs.taskId, input.taskId), eq(taskProofs.status, "pending"))).limit(1))[0];
      if (pending) fail("You already have a proof pending for this task.", "CONFLICT");
      const screenshotUrl = validateInlineUpload(input.screenshotData, { label: "screenshot", maxBytes: 2 * 1024 * 1024, acceptedType: type => type.startsWith("image/") });
      await db.insert(taskProofs).values({ userId: user.id, taskId: input.taskId, gameUserId: input.gameUserId, screenshotUrl, status: "pending" });
      return { success: true };
    }),
    myProofs: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const proofs = await db.select().from(taskProofs).where(eq(taskProofs.userId, user.id)).orderBy(desc(taskProofs.createdAt));
      return Promise.all(proofs.map(async proof => ({ ...proof, task: (await db.select({ title: tasks.title, rewardCoins: tasks.rewardCoins }).from(tasks).where(eq(tasks.id, proof.taskId)).limit(1))[0] ?? null })));
    }),
  }),
  earning: router({
    ads: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const activePackage = await getActivePackageForUser(user.id);
      const dayKey = getDayKey();
      const sessions = await db
        .select()
        .from(adSessions)
        .where(and(eq(adSessions.userId, user.id), eq(adSessions.dayKey, dayKey)));
      const quota = activePackage ? getDailyAdQuota(activePackage.plan.pricePkr) : 0;
      const claimedSlotIds = new Set(
        sessions.filter(session => session.claimedAt).map(session => session.adId)
      );
      return {
        ads: Array.from({ length: quota }, (_, index) => {
          const slot = index + 1;
          return {
            id: slot,
            title: `Ad ${slot}`,
            contentType: "rewarded" as const,
            rewardPkr: getDailyAdRewardPkr(activePackage?.plan.pricePkr ?? 0),
            timerSeconds: REWARDED_AD_TIMER_SECONDS,
            state: claimedSlotIds.has(slot) ? "watched" as const : "unlocked" as const,
          };
        }),
        watched: claimedSlotIds.size,
        total: quota,
        resetAt: getNextPakistanMidnight(),
        activePackage: activePackage
          ? {
              name: activePackage.plan.name,
              pricePkr: activePackage.plan.pricePkr,
              quota,
              rewardPkr: getDailyAdRewardPkr(activePackage.plan.pricePkr),
              totalDailyPkr:
                quota * getDailyAdRewardPkr(activePackage.plan.pricePkr),
            }
          : null,
      };
    }),
    startAd: protectedProcedure
      .input(z.object({ slot: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const active = await getActivePackageForUser(user.id);
        if (!active) fail("Please purchase an active package to start earning.");
        const dayKey = getDayKey();
        const sessions = await db
          .select()
          .from(adSessions)
          .where(and(eq(adSessions.userId, user.id), eq(adSessions.dayKey, dayKey)));
        const quota = getDailyAdQuota(active.plan.pricePkr);
        const claimedSlotIds = new Set(
          sessions.filter(session => session.claimedAt).map(session => session.adId)
        );
        const nextSlot = Array.from({ length: quota }, (_, index) => index + 1).find(
          slot => !claimedSlotIds.has(slot)
        );
        if (!nextSlot || input.slot > quota || claimedSlotIds.has(input.slot))
          fail("This rewarded ad has already been watched today or is not available.", "FORBIDDEN");
        if (input.slot !== nextSlot)
          fail(`Please complete Ad ${nextSlot} before starting another ad.`, "FORBIDDEN");
        const abandonedSessions = sessions.filter(
          session => !session.claimedAt && !session.invalidatedAt
        );
        if (abandonedSessions.length) {
          await db
            .update(adSessions)
            .set({ invalidatedAt: new Date() })
            .where(
              and(
                eq(adSessions.userId, user.id),
                eq(adSessions.dayKey, dayKey),
                sql`${adSessions.claimedAt} IS NULL`,
                sql`${adSessions.invalidatedAt} IS NULL`
              )
            );
        }
        const startedAt = new Date();
        const result = await db.insert(adSessions).values({
          userId: user.id,
          userPackageId: active.ownership.id,
          adId: input.slot,
          dayKey,
          startedAt,
          lastHeartbeatAt: startedAt,
          rewardPkr: getDailyAdRewardPkr(active.plan.pricePkr),
        });
        return {
          sessionId: Number(result[0].insertId),
          ad: { id: input.slot, title: `Ad ${input.slot}` },
          startedAt,
          availableAt: new Date(startedAt.getTime() + REWARDED_AD_TIMER_SECONDS * 1000),
          timerSeconds: REWARDED_AD_TIMER_SECONDS,
          restarted: abandonedSessions.length > 0,
        };
      }),
    heartbeat: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const session = (await db.select().from(adSessions).where(and(eq(adSessions.id, input.sessionId), eq(adSessions.userId, user.id))).limit(1))[0];
        if (!session || session.claimedAt || session.invalidatedAt) fail(AD_TIMER_MESSAGE, "FORBIDDEN");
        await db.update(adSessions).set({ lastHeartbeatAt: new Date() }).where(eq(adSessions.id, session.id));
        return { success: true };
      }),
    claimAd: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const session = (await db.select().from(adSessions).where(and(eq(adSessions.id, input.sessionId), eq(adSessions.userId, user.id))).limit(1))[0];
        if (!session) fail("Earning session was not found.", "NOT_FOUND");
        if (session.claimedAt) fail("This reward has already been claimed.");
        const claimStatus = getAdClaimStatus({ startedAt: session.startedAt, lastHeartbeatAt: session.lastHeartbeatAt, invalidatedAt: session.invalidatedAt, now: new Date(), timerSeconds: REWARDED_AD_TIMER_SECONDS });
        if (claimStatus !== "claimable")
          fail(claimStatus === "invalidated" ? AD_RETRY_MESSAGE : AD_TIMER_MESSAGE);
        const profile = (await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1))[0];
        if (!profile) fail("Profile was not found.", "NOT_FOUND");
        await db.update(adSessions).set({ claimedAt: new Date() }).where(eq(adSessions.id, session.id));
        await db.update(profiles).set({ earningWalletBalance: (profile.earningWalletBalance ?? 0) + session.rewardPkr * 100 }).where(eq(profiles.userId, user.id));
        await db.insert(transactions).values({ userId: user.id, type: "ad_reward", direction: "credit", amountPkr: session.rewardPkr, status: "completed", note: "Daily ad reward claimed" });
        await awardTaskReferralReward(db, user.id, session.id);
        return {
          success: true,
          rewardPkr: session.rewardPkr,
        };
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
          referenceId: String(depositId),
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
        const activePackage = await getActivePackageForUser(user.id);
        const fixedAmounts = activePackage?.plan?.tier === "pkr_500"
          ? [600, 1000, 3000, 10000]
          : activePackage?.plan?.tier === "pkr_200"
            ? [300, 500, 1000]
            : [500, 1000];
        if (input.currency !== "PKR" || !fixedAmounts.includes(amountPkr))
          fail(`Select one of the fixed withdrawal amounts: ${fixedAmounts.join(", ")} PKR.`);
        if ((profile.earningWalletBalance ?? 0) < amountPkr * 100)
          fail("Insufficient Balance");
        if (
          !["JazzCash", "Easypaisa", "USDT", "SadaPay", "NayaPay", "Other"].includes(input.walletType)
        )
          fail(WITHDRAWAL_WALLET_TYPE_MESSAGE);
        if (!input.accountName) fail(WITHDRAWAL_ACCOUNT_NAME_MESSAGE);
        if (!input.accountDetails) fail(WITHDRAWAL_WALLET_NUMBER_MESSAGE);
        if (
          input.currency === "PKR" &&
          input.walletType !== "USDT" &&
          !isValidPakistanMobileNumber(input.accountDetails)
        )
          fail(WITHDRAWAL_WALLET_NUMBER_MESSAGE);
        const db = await getDb();
        if (!db)
          fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await withDbTransaction(db, async (tx) => {
          const result = await tx.insert(withdrawals).values({
            userId: user.id,
            currency: input.currency,
            amountPkr,
            walletType: input.walletType,
            accountName: input.accountName,
            accountDetails: input.accountDetails,
            status: "pending",
          });
          const withdrawalId = Number(result[0].insertId);
          await tx
            .update(profiles)
            .set({
              earningWalletBalance:
                (profile.earningWalletBalance ?? 0) - amountPkr * 100,
            })
            .where(eq(profiles.userId, user.id));
          await tx.insert(transactions).values({
            userId: user.id,
            type: "withdrawal",
            direction: "debit",
            amountPkr,
            status: "pending",
            note: "Withdrawal request awaiting approval; wallet amount reserved",
            referenceType: "withdrawal",
            referenceId: String(withdrawalId),
          });
        });
        void sendTelegramAlert(
          [
            "💸 WITHDRAW REQUEST",
            `👤 User: ${profile.username}`,
            `💵 Amount: ${input.amount} ${input.currency}`,
            `📱 ${input.walletType}: ${input.accountName} · ${input.accountDetails}`,
          ].join("\n")
        );
        return {
          success: true,
          rewardWithdrawalSubmitted: false,
        };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const rows = await db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.userId, user.id))
        .orderBy(desc(withdrawals.createdAt));
      return rows.map(({ accountName: _accountName, accountDetails: _accountDetails, ...row }) => row);
    }),
  }),
  referral: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const relationRows = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));
      const invitedUsers = await Promise.all(relationRows.map(async relation => {
        const referred = (await db.select({ userId: profiles.userId, username: profiles.username, createdAt: profiles.createdAt, email: users.email }).from(profiles).innerJoin(users, eq(users.id, profiles.userId)).where(eq(profiles.userId, relation.referredId)).limit(1))[0];
        return {
          userId: relation.referredId,
          username: referred?.username ?? `User #${relation.referredId}`,
          email: referred?.email ?? null,
          registeredAt: referred?.createdAt ?? relation.createdAt,
          tasksCompleted: relation.totalTasksRewarded,
          maxTaskReward: relation.maxTaskReward,
          pendingTasks: Math.max(0, relation.maxTaskReward - relation.totalTasksRewarded),
          taskRewardPkr: relation.totalTaskEarnings / 100,
          withdrawCommissionPkr: relation.totalWithdrawCommission / 100,
        };
      }));
      return {
        username: profile.username,
        referralCode: profile.referralCode,
        totalReferrals: relationRows.length,
        withdrawalLimitPkr: 0,
        totalTaskRewardsPkr: relationRows.reduce((total, row) => total + row.totalTaskEarnings, 0) / 100,
        totalWithdrawCommissionPkr: relationRows.reduce((total, row) => total + row.totalWithdrawCommission, 0) / 100,
        referralEarningsPkr: relationRows.reduce((total, row) => total + row.totalTaskEarnings + row.totalWithdrawCommission, 0) / 100,
        referrals: invitedUsers,
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
    chatHistory: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(supportChatMessages).where(eq(supportChatMessages.userId, user.id)).orderBy(asc(supportChatMessages.createdAt)).limit(50);
    }),
    ask: protectedProcedure
      .input(z.object({ message: z.string().trim().min(2).max(2000), imageData: z.string().max(2_000_000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = await getActor(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const imageData = input.imageData
          ? validateInlineUpload(input.imageData, {
              label: "screenshot",
              maxBytes: 1 * 1024 * 1024,
              acceptedType: contentType => contentType.startsWith("image/"),
            })
          : null;
        const storedMessage = imageData
          ? `${input.message}\n\n[Image attached for analysis]`
          : input.message;
        await db.insert(supportChatMessages).values({ userId: user.id, role: "user", content: storedMessage, aiGenerated: false });
        const recent = await db.select().from(supportChatMessages).where(eq(supportChatMessages.userId, user.id)).orderBy(desc(supportChatMessages.createdAt)).limit(20);
        const conversation = recent.reverse().map(message => ({ role: message.role === "admin" ? "assistant" as const : message.role, content: message.content }));
        const customRules = await db.select().from(supportReplyRules).orderBy(desc(supportReplyRules.updatedAt));
        const matchedRule = customRules.find(rule => input.message.toLowerCase().includes(rule.keyword.toLowerCase()));
        let answer = matchedRule?.message ?? supportFallback(input.message);
        try {
          if (matchedRule) {
            await db.insert(supportChatMessages).values({ userId: user.id, role: "assistant", content: answer, aiGenerated: false });
            return { answer };
          }
          const llmConversation = imageData
            ? conversation.map((message, index) => index === conversation.length - 1
              ? { ...message, content: [
                  { type: "text" as const, text: `${input.message}\nAnalyze this support screenshot. Identify the visible error or status, quote any readable transaction ID, and give clear next steps. If an exact visual highlight is not possible, describe the precise area to inspect.` },
                  { type: "image_url" as const, image_url: { url: imageData, detail: "auto" as const } },
                ] }
              : message)
            : conversation;
          const response = await invokeLLM({
            model: imageData ? "gemini-3-flash-preview" : undefined,
            messages: [{ role: "system", content: SUPPORT_KNOWLEDGE_BASE }, ...llmConversation],
          });
          const generated = contentToText(response.choices?.[0]?.message?.content);
          if (generated) answer = generated.slice(0, 4000);
        } catch (error) {
          console.warn("[Support] AI response unavailable; using knowledge-base fallback.", error);
        }
        await db.insert(supportChatMessages).values({ userId: user.id, role: "assistant", content: answer, aiGenerated: true });
        return { answer };
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
          rejectionReason: z.string().trim().min(3).max(512).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        if (!input.approved && !input.rejectionReason)
          fail("Reason for rejection is required.");
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
        if (input.approved) {
          await withDbTransaction(db, async (tx) => {
            const depositSelection = tx
              .select()
              .from(deposits)
              .where(eq(deposits.id, input.id))
              .limit(1);
            const lockedDeposit = (
              await (typeof depositSelection.for === "function"
                ? depositSelection.for("update")
                : depositSelection)
            )[0];
            if (!lockedDeposit) fail("Deposit request was not found.", "NOT_FOUND");
            if (lockedDeposit.status !== "pending")
              fail("This deposit request has already been reviewed.");

            const profile = (
              await tx
                .select()
                .from(profiles)
                .where(eq(profiles.userId, lockedDeposit.userId))
                .limit(1)
            )[0];
            if (!profile) fail("The user's profile was not found.", "NOT_FOUND");

            const depositReferenceId = String(lockedDeposit.id);
            await tx.update(profiles)
              .set({ depositWalletBalance: (profile.depositWalletBalance ?? 0) + lockedDeposit.amountPkr * 100 })
              .where(eq(profiles.userId, lockedDeposit.userId));

            await tx
              .update(deposits)
              .set({
                status: "approved",
                adminNote: input.note ?? null,
                rejectionReason: null,
                reviewedAt: new Date(),
              })
              .where(eq(deposits.id, lockedDeposit.id));
            await tx
              .update(transactions)
              .set({ status: "approved" })
              .where(
                and(
                  eq(transactions.referenceType, "deposit"),
                  eq(transactions.referenceId, depositReferenceId),
                  eq(transactions.status, "pending")
                )
              );
          });
        } else {
          await withDbTransaction(db, async (tx) => {
            await tx
              .update(deposits)
              .set({
                status: "rejected",
                adminNote: input.note ?? null,
                rejectionReason: input.rejectionReason,
                reviewedAt: new Date(),
              })
              .where(eq(deposits.id, deposit.id));
            await tx
              .update(transactions)
              .set({ status: "rejected" })
              .where(
                and(
                  eq(transactions.referenceType, "deposit"),
                  eq(transactions.referenceId, String(deposit.id)),
                  eq(transactions.status, "pending")
                )
              );
          });
        }
        await notifyUser(
          db,
          deposit.userId,
          input.approved ? "Deposit approved" : "Deposit rejected",
          input.approved
            ? `Your deposit of PKR ${deposit.amountPkr} was approved.`
            : `Your deposit was rejected. Reason: ${input.rejectionReason}`
        );
        return { success: true };
      }),
    reviewWithdrawal: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          approved: z.boolean(),
          note: z.string().trim().max(512).optional(),
          rejectionReason: z.string().trim().min(3).max(512).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        if (!input.approved && !input.rejectionReason)
          fail("Reason for rejection is required.");
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
        await withDbTransaction(db, async (tx) => {
          const requestSelection = tx
            .select({ id: withdrawals.id, status: withdrawals.status })
            .from(withdrawals)
            .where(eq(withdrawals.id, request.id))
            .limit(1);
          const lockedRequest = (
            await (typeof requestSelection.for === "function"
              ? requestSelection.for("update")
              : requestSelection)
          )[0];
          if (!lockedRequest) fail("Withdrawal request was not found.", "NOT_FOUND");
          if (lockedRequest.status !== "pending")
            fail("This withdrawal request has already been reviewed.");
          if (!input.approved) {
            await tx
              .update(profiles)
              .set({
                earningWalletBalance:
                  (profile.earningWalletBalance ?? 0) + request.amountPkr * 100,
              })
              .where(eq(profiles.userId, request.userId));
          } else {
            const relation = (await tx.select().from(referrals).where(eq(referrals.referredId, request.userId)).limit(1))[0];
            if (relation?.referrerId && relation.referrerId !== request.userId) {
              const commissionCoins = request.amountPkr * 10;
              const referrer = (await tx.select().from(profiles).where(eq(profiles.userId, relation.referrerId)).limit(1))[0];
              if (referrer) {
                await tx.update(profiles).set({ earningWalletBalance: (referrer.earningWalletBalance ?? 0) + commissionCoins }).where(eq(profiles.userId, relation.referrerId));
                await tx.update(referrals).set({ totalWithdrawCommission: relation.totalWithdrawCommission + commissionCoins }).where(eq(referrals.id, relation.id));
                await tx.insert(transactions).values({ userId: relation.referrerId, type: "referral_withdraw_commission", direction: "credit", amountPkr: request.amountPkr / 10, status: "completed", note: `Referral Withdraw Commission 10%: ${request.amountPkr / 10} PKR from referred withdrawal`, referenceType: "referral_withdraw_commission", referenceId: String(request.id) });
              }
            }
          }
          await tx
            .update(withdrawals)
            .set({
              status: input.approved ? "approved" : "rejected",
              adminNote: input.note ?? null,
              rejectionReason: input.approved ? null : input.rejectionReason,
              reviewedAt: new Date(),
            })
            .where(eq(withdrawals.id, request.id));
          if (
            input.approved &&
            profile.whatsappRewardEligible &&
            profile.whatsappBonusClaimed &&
            !profile.whatsappRewardWithdrawn &&
            request.currency === "PKR" &&
            request.amountPkr === WHATSAPP_JOIN_REWARD_PKR
          )
            await tx
              .update(profiles)
              .set({ whatsappRewardWithdrawn: true })
              .where(eq(profiles.userId, request.userId));
          await tx
            .update(transactions)
            .set({
              status: input.approved ? "approved" : "rejected",
              direction: input.approved ? "debit" : "neutral",
            })
            .where(
              and(
                eq(transactions.referenceType, "withdrawal"),
                eq(transactions.referenceId, String(request.id)),
                eq(transactions.status, "pending")
              )
            );
        });
        await notifyUser(
          db,
          request.userId,
          input.approved ? "Withdrawal approved" : "Withdrawal rejected",
          input.approved
            ? `Your withdrawal of PKR ${request.amountPkr} was approved.`
            : `Your withdrawal was rejected. Reason: ${input.rejectionReason}`
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
          type: z.enum(["info", "warning"]).default("info"),
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
    deleteBroadcast: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(broadcasts).set({ isActive: false }).where(eq(broadcasts.id, input.id));
      return { success: true };
    }),
    supportReplyRules: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(supportReplyRules).orderBy(desc(supportReplyRules.updatedAt));
    }),
    saveSupportReplyRule: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), keyword: z.string().trim().min(2).max(120), message: z.string().trim().min(2).max(5000) })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (input.id) await db.update(supportReplyRules).set({ keyword: input.keyword, message: input.message }).where(eq(supportReplyRules.id, input.id));
      else await db.insert(supportReplyRules).values({ keyword: input.keyword, message: input.message });
      return { success: true };
    }),
    deleteSupportReplyRule: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.delete(supportReplyRules).where(eq(supportReplyRules.id, input.id));
      return { success: true };
    }),
    tasks: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      return rows.map(row => ({ ...row, profitCoins: Math.max(0, row.hiddenProfit - row.rewardCoins) }));
    }),
    saveTask: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), title: z.string().trim().min(2).max(160), imageData: z.string().max(3_000_000).optional(), description: z.string().trim().min(5).max(10000), rewardCoins: z.number().int().positive(), hiddenProfit: z.number().int().nonnegative(), playstoreLink: z.string().url().max(1024), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const imageUrl = input.imageData ? validateInlineUpload(input.imageData, { label: "task image", maxBytes: 2 * 1024 * 1024, acceptedType: type => type.startsWith("image/") }) : undefined;
      const values = { title: input.title, description: input.description, rewardCoins: input.rewardCoins, hiddenProfit: input.hiddenProfit, playstoreLink: input.playstoreLink, isActive: input.isActive, ...(imageUrl !== undefined ? { imageUrl } : {}) };
      if (input.id) await db.update(tasks).set(values).where(eq(tasks.id, input.id));
      else await db.insert(tasks).values({ ...values, imageUrl: imageUrl ?? null });
      return { success: true };
    }),
    deleteTask: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(tasks).set({ isActive: false }).where(eq(tasks.id, input.id));
      return { success: true };
    }),
    taskProofs: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const proofs = await db.select().from(taskProofs).orderBy(desc(taskProofs.createdAt));
      return Promise.all(proofs.map(async proof => {
        const task = (await db.select({ title: tasks.title, rewardCoins: tasks.rewardCoins }).from(tasks).where(eq(tasks.id, proof.taskId)).limit(1))[0];
        const member = (await db.select({ username: profiles.username, email: users.email }).from(profiles).innerJoin(users, eq(users.id, profiles.userId)).where(eq(profiles.userId, proof.userId)).limit(1))[0];
        return { ...proof, task, member };
      }));
    }),
    reviewTaskProof: protectedProcedure.input(z.object({ id: z.number().int().positive(), approved: z.boolean(), rejectReason: z.string().trim().min(3).max(1000).optional() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      if (!input.approved && !input.rejectReason) fail("A rejection reason is required.");
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const proof = (await db.select().from(taskProofs).where(eq(taskProofs.id, input.id)).limit(1))[0];
      if (!proof) fail("Task proof was not found.", "NOT_FOUND");
      if (proof.status !== "pending") fail("This task proof has already been reviewed.");
      const task = (await db.select().from(tasks).where(eq(tasks.id, proof.taskId)).limit(1))[0];
      if (!task) fail("Task was not found.", "NOT_FOUND");
      await withDbTransaction(db, async tx => {
        if (input.approved) {
          const profile = (await tx.select().from(profiles).where(eq(profiles.userId, proof.userId)).limit(1))[0];
          if (!profile) fail("The user's profile was not found.", "NOT_FOUND");
          await tx.update(profiles).set({ earningWalletBalance: (profile.earningWalletBalance ?? 0) + task.rewardCoins }).where(eq(profiles.userId, proof.userId));
          await tx.insert(transactions).values({ userId: proof.userId, type: "manual_task_reward", direction: "credit", amountPkr: Math.floor(task.rewardCoins / 100), status: "completed", note: `Manual task reward: ${task.rewardCoins} coins`, referenceType: "task_proof", referenceId: String(proof.id) });
          await tx.update(taskProofs).set({ status: "approved", rejectReason: null, reviewedAt: new Date() }).where(eq(taskProofs.id, proof.id));
          await awardTaskReferralReward(tx, proof.userId, proof.taskId);
        } else {
          await tx.update(taskProofs).set({ status: "rejected", rejectReason: input.rejectReason, reviewedAt: new Date() }).where(eq(taskProofs.id, proof.id));
        }
      });
      await notifyUser(db, proof.userId, input.approved ? "Task proof approved" : "Task proof rejected", input.approved ? `Your task proof was approved and ${task.rewardCoins} coins were added.` : `Your task proof was rejected. Reason: ${input.rejectReason}`);
      return { success: true };
    }),
    sendNotification: protectedProcedure.input(z.object({ userId: z.number().int().positive(), title: z.string().trim().min(2).max(140), message: z.string().trim().min(2).max(5000) })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await notifyUser(db, input.userId, input.title, input.message);
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
    supportChats: protectedProcedure
      .input(z.object({ search: z.string().trim().max(120).optional() }).optional())
      .query(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        const memberRows = await db.select({ userId: users.id, email: users.email, username: profiles.username, balancePkr: profiles.balancePkr, withdrawalLimitPkr: profiles.withdrawalLimitPkr }).from(users).innerJoin(profiles, eq(users.id, profiles.userId));
        const filteredMembers = input?.search ? memberRows.filter(member => `${member.username ?? ""} ${member.email ?? ""}`.toLowerCase().includes(input.search!.toLowerCase())) : memberRows;
        const rows = await Promise.all(filteredMembers.map(async member => ({ ...member, activePackage: (await getActivePackageForUser(member.userId))?.plan.name ?? null, messages: await db.select().from(supportChatMessages).where(eq(supportChatMessages.userId, member.userId)).orderBy(asc(supportChatMessages.createdAt)).limit(100) })));
        return rows.filter(row => row.messages.length > 0);
      }),
    supportChatReply: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), content: z.string().trim().min(2).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        await getAdmin(ctx);
        const db = await getDb();
        if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
        await db.insert(supportChatMessages).values({ userId: input.userId, role: "admin", content: input.content, aiGenerated: false });
        return { success: true };
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
            adTimerSeconds: REWARDED_AD_TIMER_SECONDS,
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
