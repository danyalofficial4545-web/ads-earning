import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  adSessions,
  ads,
  appSettings,
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
import { storagePut } from "./storage";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { createLocalSession, hashPassword, LOCAL_SESSION_COOKIE, verifyPassword } from "./localAuth";
import { AD_TIMER_MESSAGE, canClaimAd, canUseMemberWorkspace, fromPkr, referralLimitCredit, toPkr, validateWithdrawalRequest } from "./rules";

function fail(message: string, code: TRPCError["code"] = "BAD_REQUEST"): never {
  throw new TRPCError({ code, message });
}

function publicUser(user: typeof users.$inferSelect) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function getActor(ctx: { user: NonNullable<unknown> }) {
  const user = ctx.user as typeof users.$inferSelect;
  const profile = await ensureProfile(user);
  if (!canUseMemberWorkspace(profile.isBlocked)) fail("Your account is currently restricted. Please contact support.", "FORBIDDEN");
  return { user, profile };
}

async function getAdmin(ctx: { user: NonNullable<unknown> }) {
  const actor = await getActor(ctx);
  if (!isDesignatedAdmin(actor.user, actor.profile)) fail("Administrator access is restricted.", "FORBIDDEN");
  return actor;
}

async function saveUpload(userId: number, raw: string, category: string) {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) fail("Please upload a valid image file.");
  const [, contentType, base64] = match;
  if (!contentType.startsWith("image/")) fail("Only image uploads are supported.");
  const file = Buffer.from(base64, "base64");
  if (file.length === 0 || file.length > 5 * 1024 * 1024) fail("Image upload must be between 1 byte and 5 MB.");
  const extension = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  const key = `package-earn-pro/${category}/${userId}/${Date.now()}.${extension}`;
  return storagePut(key, file, contentType);
}

async function buildOverview(userId: number) {
  const db = await getDb();
  if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
  const settings = await getSettings();
  const profile = (await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0];
  if (!profile) fail("Profile was not found.", "NOT_FOUND");
  const activePackage = await getActivePackageForUser(userId);
  const dayKey = getDayKey();
  const watchedRows = await db.select({ count: sql<number>`count(*)` }).from(adSessions)
    .where(and(eq(adSessions.userId, userId), eq(adSessions.dayKey, dayKey), sql`${adSessions.claimedAt} IS NOT NULL`));
  const totalEarned = await db.select({ total: sql<number>`coalesce(sum(${transactions.amountPkr}), 0)` }).from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "ad_reward"), eq(transactions.direction, "credit")));
  const daysRemaining = activePackage ? Math.max(0, Math.ceil((activePackage.ownership.expiresAt.getTime() - Date.now()) / 86_400_000)) : 0;
  return {
    profile,
    settings,
    activePackage: activePackage ? { ...activePackage.plan, ownershipId: activePackage.ownership.id, expiresAt: activePackage.ownership.expiresAt, daysRemaining } : null,
    todayAds: { watched: Number(watchedRows[0]?.count ?? 0), total: activePackage?.plan.dailyAds ?? 0 },
    totalEarnedPkr: Number(totalEarned[0]?.total ?? 0),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user ? publicUser(opts.ctx.user) : null),
    register: publicProcedure.input(z.object({
      username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only."),
      email: z.string().trim().email("Enter a valid Gmail or email address.").max(320),
      password: z.string().min(8, "Password must be at least 8 characters.").max(128),
      referralCode: z.string().trim().max(32).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const email = input.email.toLowerCase();
      const username = input.username.toLowerCase();
      const isDesignated = email === ADMIN_EMAIL && username === "danyal955163";
      if (username === "danyal955163" && !isDesignated) fail("This username is reserved for the designated administrator.", "FORBIDDEN");
      if (email === ADMIN_EMAIL && !isDesignated) fail("This email must use the designated administrator username.", "FORBIDDEN");
      const [emailMatch, usernameMatch] = await Promise.all([
        db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
        db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, username)).limit(1),
      ]);
      if (emailMatch[0]) fail("An account already exists for this email address.", "CONFLICT");
      if (usernameMatch[0]) fail("That username is already in use.", "CONFLICT");
      let referredByUserId: number | null = null;
      if (input.referralCode) {
        const referrer = await db.select().from(profiles).where(eq(profiles.referralCode, input.referralCode.toUpperCase())).limit(1);
        if (!referrer[0]) fail("Referral code was not found.");
        referredByUserId = referrer[0].userId;
      }
      const created = await db.insert(users).values({
        openId: `local_${randomUUID()}`,
        name: username,
        email,
        passwordHash: await hashPassword(input.password),
        loginMethod: "password",
        role: isDesignated ? "admin" : "user",
        lastSignedIn: new Date(),
      });
      const userId = Number(created[0].insertId);
      await db.insert(profiles).values({ userId, username, referralCode: `PEP${userId.toString(36).toUpperCase()}`, referredByUserId, balancePkr: 0, withdrawalLimitPkr: 0, preferredCurrency: "PKR" });
      const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
      if (!user) fail("Account creation failed.", "INTERNAL_SERVER_ERROR");
      ctx.res.cookie(LOCAL_SESSION_COOKIE, await createLocalSession(user.id), { ...getSessionCookieOptions(ctx.req), maxAge: 7 * 24 * 60 * 60 * 1000 });
      return { user: publicUser(user) };
    }),
    signIn: publicProcedure.input(z.object({
      email: z.string().trim().email("Enter a valid Gmail or email address.").max(320),
      password: z.string().min(1, "Enter your password."),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const user = (await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1))[0];
      if (!user || !await verifyPassword(input.password, user.passwordHash)) fail("Incorrect email or password.", "UNAUTHORIZED");
      const profile = await ensureProfile(user);
      if (profile.isBlocked) fail("Your account is currently restricted. Please contact support.", "FORBIDDEN");
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
      ctx.res.cookie(LOCAL_SESSION_COOKIE, await createLocalSession(user.id), { ...getSessionCookieOptions(ctx.req), maxAge: 7 * 24 * 60 * 60 * 1000 });
      return { user: publicUser(user) };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  account: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      return { user, profile, isAdmin: isDesignatedAdmin(user, profile) };
    }),
    saveProfile: protectedProcedure.input(z.object({
      username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only."),
      referralCode: z.string().trim().max(32).optional(),
      preferredCurrency: z.enum(["PKR", "USD"]),
    })).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const requestedName = input.username.toLowerCase();
      if (requestedName === "danyal955163" && user.email?.toLowerCase() !== ADMIN_EMAIL) fail("This username is reserved for the designated administrator.", "FORBIDDEN");
      const duplicate = await db.select().from(profiles).where(eq(profiles.username, requestedName)).limit(1);
      if (duplicate[0] && duplicate[0].userId !== user.id) fail("That username is already in use.");
      let referredByUserId = profile.referredByUserId;
      if (input.referralCode && !referredByUserId) {
        const referrer = await db.select().from(profiles).where(eq(profiles.referralCode, input.referralCode.toUpperCase())).limit(1);
        if (!referrer[0]) fail("Referral code was not found.");
        if (referrer[0].userId === user.id) fail("You cannot use your own referral code.");
        referredByUserId = referrer[0].userId;
      }
      if (isDesignatedAdmin(user, profile) && requestedName !== "danyal955163") fail("The designated administrator username cannot be changed.");
      await db.update(profiles).set({ username: requestedName, preferredCurrency: input.preferredCurrency, referredByUserId }).where(eq(profiles.userId, user.id));
      return { success: true };
    }),
  }),
  platform: router({
    publicData: publicProcedure.query(async () => {
      await ensurePlatformData();
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return {
        packages: await db.select().from(packages).where(eq(packages.isActive, true)),
        settings: await getSettings(),
      };
    }),
    overview: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      return buildOverview(user.id);
    }),
    announcements: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(10);
    }),
  }),
  package: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await ensurePlatformData();
      return db.select().from(packages).where(eq(packages.isActive, true));
    }),
    buy: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const plan = (await db.select().from(packages).where(and(eq(packages.id, input.packageId), eq(packages.isActive, true))).limit(1))[0];
      if (!plan) fail("That package is not available.", "NOT_FOUND");
      if (profile.balancePkr < plan.pricePkr) fail("Your wallet balance is insufficient. Please deposit funds first.");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationDays * 86_400_000);
      await db.update(profiles).set({ balancePkr: profile.balancePkr - plan.pricePkr }).where(eq(profiles.userId, user.id));
      await db.insert(userPackages).values({ userId: user.id, packageId: plan.id, purchasedAt: now, expiresAt });
      await db.insert(transactions).values({ userId: user.id, type: "package", direction: "debit", amountPkr: plan.pricePkr, status: "completed", note: `${plan.name} package purchased` });
      if (profile.referredByUserId) {
        const settings = await getSettings();
        const credit = referralLimitCredit(plan.pricePkr, settings.referralCommissionPercent);
        const referrer = (await db.select().from(profiles).where(eq(profiles.userId, profile.referredByUserId)).limit(1))[0];
        if (referrer) {
          await db.update(profiles).set({ withdrawalLimitPkr: referrer.withdrawalLimitPkr + credit }).where(eq(profiles.userId, referrer.userId));
          await db.insert(transactions).values({ userId: referrer.userId, type: "referral_limit", direction: "neutral", amountPkr: credit, status: "completed", note: `Referral withdrawal limit unlocked by ${plan.name} purchase` });
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
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const recent = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(5);
      return { ...data, recent, balanceUsd: fromPkr(data.profile.balancePkr, data.settings.exchangeRatePkrPerUsd), withdrawalLimitUsd: fromPkr(data.profile.withdrawalLimitPkr, data.settings.exchangeRatePkrPerUsd) };
    }),
    transactions: protectedProcedure.input(z.object({
      type: z.enum(["all", "deposit", "package", "ad_reward", "withdrawal", "referral_limit", "adjustment"]).default("all"),
      status: z.enum(["all", "pending", "approved", "rejected", "completed"]).default("all"),
    })).query(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const rows = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt));
      return rows.filter((row) => (input.type === "all" || row.type === input.type) && (input.status === "all" || row.status === input.status));
    }),
  }),
  earning: router({
    startAd: protectedProcedure.mutation(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const active = await getActivePackageForUser(user.id);
      if (!active) fail("Please purchase an active package to start earning.");
      const dayKey = getDayKey();
      const completed = await db.select({ count: sql<number>`count(*)` }).from(adSessions).where(and(eq(adSessions.userId, user.id), eq(adSessions.dayKey, dayKey), sql`${adSessions.claimedAt} IS NOT NULL`));
      if (Number(completed[0]?.count ?? 0) >= active.plan.dailyAds) fail("You have completed all ads available for today.");
      const available = await db.select().from(ads).where(and(eq(ads.packageTier, active.plan.tier), eq(ads.isActive, true))).limit(1);
      if (!available[0]) fail("No active ads have been assigned to your package yet.");
      const startedAt = new Date();
      const result = await db.insert(adSessions).values({ userId: user.id, userPackageId: active.ownership.id, adId: available[0].id, dayKey, startedAt, lastHeartbeatAt: startedAt });
      const settings = await getSettings();
      return { sessionId: Number(result[0].insertId), ad: available[0], startedAt, availableAt: new Date(startedAt.getTime() + settings.adTimerSeconds * 1000), timerSeconds: settings.adTimerSeconds };
    }),
    heartbeat: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const session = (await db.select().from(adSessions).where(and(eq(adSessions.id, input.sessionId), eq(adSessions.userId, user.id))).limit(1))[0];
      if (!session || session.claimedAt || session.invalidatedAt) fail(AD_TIMER_MESSAGE, "FORBIDDEN");
      if (Date.now() - session.lastHeartbeatAt.getTime() > 10_000) {
        await db.update(adSessions).set({ invalidatedAt: new Date() }).where(eq(adSessions.id, session.id));
        fail(AD_TIMER_MESSAGE, "FORBIDDEN");
      }
      await db.update(adSessions).set({ lastHeartbeatAt: new Date() }).where(eq(adSessions.id, session.id));
      return { success: true };
    }),
    claimAd: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const session = (await db.select().from(adSessions).where(and(eq(adSessions.id, input.sessionId), eq(adSessions.userId, user.id))).limit(1))[0];
      if (!session) fail("Earning session was not found.", "NOT_FOUND");
      if (session.claimedAt) fail("This reward has already been claimed.");
      if (session.invalidatedAt || Date.now() - session.lastHeartbeatAt.getTime() > 10_000) {
        if (!session.invalidatedAt) await db.update(adSessions).set({ invalidatedAt: new Date() }).where(eq(adSessions.id, session.id));
        fail(AD_TIMER_MESSAGE);
      }
      const settings = await getSettings();
      if (!canClaimAd(session.startedAt, new Date(), settings.adTimerSeconds)) fail(AD_TIMER_MESSAGE);
      const profile = (await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1))[0];
      if (!profile) fail("Profile was not found.", "NOT_FOUND");
      await db.update(adSessions).set({ claimedAt: new Date() }).where(eq(adSessions.id, session.id));
      await db.update(profiles).set({ balancePkr: profile.balancePkr + session.rewardPkr }).where(eq(profiles.userId, user.id));
      await db.insert(transactions).values({ userId: user.id, type: "ad_reward", direction: "credit", amountPkr: session.rewardPkr, status: "completed", note: "Daily ad reward claimed" });
      return { success: true, rewardPkr: session.rewardPkr };
    }),
  }),
  deposit: router({
    accounts: protectedProcedure.input(z.object({ currency: z.enum(["PKR", "USD"]) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(paymentAccounts).where(and(eq(paymentAccounts.currency, input.currency), eq(paymentAccounts.isActive, true)));
    }),
    create: protectedProcedure.input(z.object({
      currency: z.enum(["PKR", "USD"]),
      amount: z.number().positive(),
      method: z.string().trim().min(2).max(64),
      proofData: z.string().min(24),
    })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const settings = await getSettings();
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const receipt = await saveUpload(user.id, input.proofData, "deposit-proofs");
      const amountPkr = toPkr(input.amount, input.currency, settings.exchangeRatePkrPerUsd);
      const result = await db.insert(deposits).values({ userId: user.id, currency: input.currency, amountPkr, method: input.method, proofUrl: receipt.url, proofKey: receipt.key, status: "pending" });
      const depositId = Number(result[0].insertId);
      await db.insert(transactions).values({ userId: user.id, type: "deposit", direction: "neutral", amountPkr, status: "pending", note: `${input.method} deposit awaiting approval`, referenceType: "deposit", referenceId: depositId });
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(deposits).where(eq(deposits.userId, user.id)).orderBy(desc(deposits.createdAt));
    }),
  }),
  withdrawal: router({
    create: protectedProcedure.input(z.object({
      currency: z.enum(["PKR", "USD"]), amount: z.number().positive(), accountName: z.string().trim().min(2).max(128), accountDetails: z.string().trim().min(4).max(512),
    })).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const settings = await getSettings();
      const amountPkr = toPkr(input.amount, input.currency, settings.exchangeRatePkrPerUsd);
      const withdrawalError = validateWithdrawalRequest({
        balancePkr: profile.balancePkr,
        withdrawalLimitPkr: profile.withdrawalLimitPkr,
        amountPkr,
        minimumWithdrawalPkr: settings.minimumWithdrawalPkr,
        maximumWithdrawalPkr: settings.maximumWithdrawalPkr,
      });
      if (withdrawalError) fail(withdrawalError);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const result = await db.insert(withdrawals).values({ userId: user.id, currency: input.currency, amountPkr, accountName: input.accountName, accountDetails: input.accountDetails, status: "pending" });
      const withdrawalId = Number(result[0].insertId);
      await db.insert(transactions).values({ userId: user.id, type: "withdrawal", direction: "neutral", amountPkr, status: "pending", note: "Withdrawal request awaiting approval", referenceType: "withdrawal", referenceId: withdrawalId });
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(withdrawals).where(eq(withdrawals.userId, user.id)).orderBy(desc(withdrawals.createdAt));
    }),
  }),
  referral: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const referrals = await db.select({ userId: profiles.userId, username: profiles.username, createdAt: profiles.createdAt }).from(profiles).where(eq(profiles.referredByUserId, user.id));
      const purchaserRows = referrals.length ? await db.select({ userId: userPackages.userId }).from(userPackages).where(inArray(userPackages.userId, referrals.map((referral) => referral.userId))) : [];
      const purchasers = new Set(purchaserRows.map((row) => row.userId));
      return { referralCode: profile.referralCode, totalReferrals: referrals.length, purchasedReferrals: purchasers.size, withdrawalLimitPkr: profile.withdrawalLimitPkr, referrals };
    }),
  }),
  support: router({
    create: protectedProcedure.input(z.object({ subject: z.string().trim().min(3).max(140), description: z.string().trim().min(10).max(5000), screenshotData: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const upload = input.screenshotData ? await saveUpload(user.id, input.screenshotData, "support") : null;
      await db.insert(supportTickets).values({ userId: user.id, subject: input.subject, description: input.description, screenshotUrl: upload?.url, screenshotKey: upload?.key, status: "open" });
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.updatedAt));
    }),
  }),
  admin: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [pendingDeposits, pendingWithdrawals, openTickets, userCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(deposits).where(eq(deposits.status, "pending")),
        db.select({ count: sql<number>`count(*)` }).from(withdrawals).where(eq(withdrawals.status, "pending")),
        db.select({ count: sql<number>`count(*)` }).from(supportTickets).where(sql`${supportTickets.status} != 'resolved'`),
        db.select({ count: sql<number>`count(*)` }).from(profiles),
      ]);
      return { pendingDeposits: Number(pendingDeposits[0]?.count ?? 0), pendingWithdrawals: Number(pendingWithdrawals[0]?.count ?? 0), openTickets: Number(openTickets[0]?.count ?? 0), userCount: Number(userCount[0]?.count ?? 0) };
    }),
    financialRequests: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return { deposits: await db.select().from(deposits).orderBy(desc(deposits.createdAt)), withdrawals: await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)) };
    }),
    reviewDeposit: protectedProcedure.input(z.object({ id: z.number().int().positive(), approved: z.boolean(), note: z.string().trim().max(512).optional() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const deposit = (await db.select().from(deposits).where(eq(deposits.id, input.id)).limit(1))[0];
      if (!deposit) fail("Deposit request was not found.", "NOT_FOUND");
      if (deposit.status !== "pending") fail("This deposit request has already been reviewed.");
      const status = input.approved ? "approved" : "rejected";
      await db.update(deposits).set({ status, adminNote: input.note ?? null, reviewedAt: new Date() }).where(eq(deposits.id, deposit.id));
      await db.update(transactions).set({ status: input.approved ? "approved" : "rejected" }).where(and(eq(transactions.referenceType, "deposit"), eq(transactions.referenceId, deposit.id), eq(transactions.status, "pending")));
      if (input.approved) {
        const profile = (await db.select().from(profiles).where(eq(profiles.userId, deposit.userId)).limit(1))[0];
        if (profile) await db.update(profiles).set({ balancePkr: profile.balancePkr + deposit.amountPkr }).where(eq(profiles.userId, deposit.userId));
      }
      return { success: true };
    }),
    reviewWithdrawal: protectedProcedure.input(z.object({ id: z.number().int().positive(), approved: z.boolean(), note: z.string().trim().max(512).optional() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const request = (await db.select().from(withdrawals).where(eq(withdrawals.id, input.id)).limit(1))[0];
      if (!request) fail("Withdrawal request was not found.", "NOT_FOUND");
      if (request.status !== "pending") fail("This withdrawal request has already been reviewed.");
      if (input.approved) {
        const profile = (await db.select().from(profiles).where(eq(profiles.userId, request.userId)).limit(1))[0];
        if (!profile || profile.balancePkr < request.amountPkr || profile.withdrawalLimitPkr < request.amountPkr) fail("The user's balance or withdrawal limit is no longer sufficient.");
        await db.update(profiles).set({ balancePkr: profile.balancePkr - request.amountPkr, withdrawalLimitPkr: profile.withdrawalLimitPkr - request.amountPkr }).where(eq(profiles.userId, request.userId));
      }
      await db.update(withdrawals).set({ status: input.approved ? "approved" : "rejected", adminNote: input.note ?? null, reviewedAt: new Date() }).where(eq(withdrawals.id, request.id));
      await db.update(transactions).set({ status: input.approved ? "approved" : "rejected", direction: input.approved ? "debit" : "neutral" }).where(and(eq(transactions.referenceType, "withdrawal"), eq(transactions.referenceId, request.id), eq(transactions.status, "pending")));
      return { success: true };
    }),
    users: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, profile: profiles }).from(users).innerJoin(profiles, eq(users.id, profiles.userId)).orderBy(desc(users.createdAt));
    }),
    setBlocked: protectedProcedure.input(z.object({ userId: z.number().int().positive(), blocked: z.boolean() })).mutation(async ({ ctx, input }) => {
      const { user } = await getAdmin(ctx);
      if (input.userId === user.id) fail("The designated administrator cannot be blocked.");
      const db = await getDb();
      if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(profiles).set({ isBlocked: input.blocked }).where(eq(profiles.userId, input.userId));
      return { success: true };
    }),
    ads: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); return db.select().from(ads).orderBy(desc(ads.updatedAt));
    }),
    saveAd: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), packageTier: z.string().min(3).max(24), title: z.string().trim().min(3).max(128), contentType: z.enum(["text", "image", "video", "link"]), content: z.string().trim().min(1), targetUrl: z.string().url().optional(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (input.id) { await db.update(ads).set({ ...input, targetUrl: input.targetUrl ?? null }).where(eq(ads.id, input.id)); } else { await db.insert(ads).values({ ...input, targetUrl: input.targetUrl ?? null }); }
      return { success: true };
    }),
    deleteAd: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); await db.delete(ads).where(eq(ads.id, input.id)); return { success: true }; }),
    paymentAccounts: protectedProcedure.query(async ({ ctx }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); return db.select().from(paymentAccounts).orderBy(paymentAccounts.currency, paymentAccounts.provider); }),
    savePaymentAccount: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), currency: z.enum(["PKR", "USD"]), provider: z.string().trim().min(2).max(64), accountName: z.string().trim().min(2).max(128), accountDetails: z.string().trim().min(3).max(256), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (input.id) await db.update(paymentAccounts).set(input).where(eq(paymentAccounts.id, input.id)); else await db.insert(paymentAccounts).values(input);
      return { success: true };
    }),
    deletePaymentAccount: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); await db.delete(paymentAccounts).where(eq(paymentAccounts.id, input.id)); return { success: true }; }),
    broadcasts: protectedProcedure.query(async ({ ctx }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); return db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)); }),
    createBroadcast: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(140), body: z.string().trim().min(3).max(5000), mediaUrl: z.string().url().optional() })).mutation(async ({ ctx, input }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); await db.insert(broadcasts).values({ ...input, mediaUrl: input.mediaUrl ?? null }); return { success: true }; }),
    tickets: protectedProcedure.query(async ({ ctx }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); return db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt)); }),
    respondTicket: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["open", "in_review", "resolved"]), response: z.string().trim().max(5000).optional() })).mutation(async ({ ctx, input }) => { await getAdmin(ctx); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); await db.update(supportTickets).set({ status: input.status, adminResponse: input.response ?? null, respondedAt: input.response ? new Date() : null }).where(eq(supportTickets.id, input.id)); return { success: true }; }),
    settings: protectedProcedure.query(async ({ ctx }) => { await getAdmin(ctx); return getSettings(); }),
    saveSettings: protectedProcedure.input(z.object({ exchangeRatePkrPerUsd: z.number().int().min(1), minimumWithdrawalPkr: z.number().int().min(1), maximumWithdrawalPkr: z.number().int().min(1), adTimerSeconds: z.number().int().min(5).max(600), referralCommissionPercent: z.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => { await getAdmin(ctx); if (input.maximumWithdrawalPkr < input.minimumWithdrawalPkr) fail("Maximum withdrawal must be greater than the minimum."); const db = await getDb(); if (!db) fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR"); await db.update(appSettings).set(input).where(eq(appSettings.id, 1)); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
