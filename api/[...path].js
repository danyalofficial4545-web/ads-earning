// server/vercel-api.ts
import "dotenv/config";

// server/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  deviceFingerprintHash: varchar("deviceFingerprintHash", { length: 64 }),
  registrationIpHash: varchar("registrationIpHash", { length: 64 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_device_fingerprint_unique").on(table.deviceFingerprintHash),
  uniqueIndex("users_registration_ip_unique").on(table.registrationIpHash)
]);
var profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 32 }).notNull(),
  referralCode: varchar("referralCode", { length: 32 }).notNull(),
  referredByUserId: int("referredByUserId"),
  balancePkr: int("balancePkr").notNull().default(0),
  withdrawalLimitPkr: int("withdrawalLimitPkr").notNull().default(0),
  preferredCurrency: mysqlEnum("preferredCurrency", ["PKR", "USD"]).notNull().default("PKR"),
  isBlocked: boolean("isBlocked").notNull().default(false),
  whatsappJoined: boolean("whatsappJoined").notNull().default(false),
  whatsappBonusClaimed: boolean("whatsappBonusClaimed").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  uniqueIndex("profiles_user_id_unique").on(table.userId),
  uniqueIndex("profiles_username_unique").on(table.username),
  uniqueIndex("profiles_referral_code_unique").on(table.referralCode)
]);
var packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  tier: varchar("tier", { length: 24 }).notNull(),
  name: varchar("name", { length: 40 }).notNull(),
  icon: varchar("icon", { length: 12 }).notNull(),
  pricePkr: int("pricePkr").notNull(),
  dailyAds: int("dailyAds").notNull(),
  durationDays: int("durationDays").notNull().default(30),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("packages_tier_unique").on(table.tier)]);
var userPackages = mysqlTable("userPackages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  packageId: int("packageId").notNull(),
  purchasedAt: timestamp("purchasedAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("user_packages_user_expiry_idx").on(table.userId, table.expiresAt)
]);
var paymentAccounts = mysqlTable("paymentAccounts", {
  id: int("id").autoincrement().primaryKey(),
  currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
  currencyType: varchar("currencyType", { length: 32 }).notNull().default("PKR"),
  provider: varchar("provider", { length: 64 }).notNull(),
  accountType: varchar("accountType", { length: 64 }).notNull().default("Payment account"),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountDetails: varchar("accountDetails", { length: 256 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  packageTier: varchar("packageTier", { length: 24 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  contentType: mysqlEnum("contentType", ["text", "image", "video", "link", "app"]).notNull().default("text"),
  content: text("content").notNull(),
  targetUrl: varchar("targetUrl", { length: 1024 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("ads_package_active_idx").on(table.packageTier, table.isActive)]);
var adSessions = mysqlTable("adSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userPackageId: int("userPackageId").notNull(),
  adId: int("adId").notNull(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  startedAt: timestamp("startedAt").notNull(),
  lastHeartbeatAt: timestamp("lastHeartbeatAt").notNull(),
  claimedAt: timestamp("claimedAt"),
  invalidatedAt: timestamp("invalidatedAt"),
  rewardPkr: int("rewardPkr").notNull().default(20),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("ad_sessions_user_day_idx").on(table.userId, table.dayKey)
]);
var transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "package", "ad_reward", "withdrawal", "referral_limit", "adjustment"]).notNull(),
  direction: mysqlEnum("direction", ["credit", "debit", "neutral"]).notNull(),
  amountPkr: int("amountPkr").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "completed"]).notNull().default("completed"),
  note: varchar("note", { length: 256 }).notNull(),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("transactions_user_created_idx").on(table.userId, table.createdAt)]);
var deposits = mysqlTable("deposits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
  amountPkr: int("amountPkr").notNull(),
  method: varchar("method", { length: 64 }).notNull(),
  senderAccountNumber: varchar("senderAccountNumber", { length: 256 }),
  senderAccountName: varchar("senderAccountName", { length: 128 }),
  transactionId: varchar("transactionId", { length: 128 }),
  requestedPackageId: int("requestedPackageId"),
  proofUrl: varchar("proofUrl", { length: 1024 }).notNull(),
  proofKey: varchar("proofKey", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  adminNote: varchar("adminNote", { length: 512 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("deposits_user_status_idx").on(table.userId, table.status)]);
var authChallenges = mysqlTable("authChallenges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  purpose: mysqlEnum("purpose", ["sign_in", "sign_up"]).notNull(),
  prompt: varchar("prompt", { length: 140 }).notNull(),
  answerHash: varchar("answerHash", { length: 64 }).notNull(),
  deviceFingerprintHash: varchar("deviceFingerprintHash", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("auth_challenges_device_expiry_idx").on(table.deviceFingerprintHash, table.expiresAt)]);
var withdrawals = mysqlTable("withdrawals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
  amountPkr: int("amountPkr").notNull(),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountDetails: varchar("accountDetails", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  adminNote: varchar("adminNote", { length: 512 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("withdrawals_user_status_idx").on(table.userId, table.status)]);
var supportTickets = mysqlTable("supportTickets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subject: varchar("subject", { length: 140 }).notNull(),
  description: text("description").notNull(),
  screenshotUrl: varchar("screenshotUrl", { length: 1024 }),
  screenshotKey: varchar("screenshotKey", { length: 512 }),
  status: mysqlEnum("status", ["open", "in_review", "resolved"]).notNull().default("open"),
  adminResponse: text("adminResponse"),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("tickets_user_status_idx").on(table.userId, table.status)]);
var broadcasts = mysqlTable("broadcasts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  body: text("body").notNull(),
  mediaUrl: varchar("mediaUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
  exchangeRatePkrPerUsd: int("exchangeRatePkrPerUsd").notNull().default(280),
  minimumWithdrawalPkr: int("minimumWithdrawalPkr").notNull().default(50),
  maximumWithdrawalPkr: int("maximumWithdrawalPkr").notNull().default(3e3),
  adTimerSeconds: int("adTimerSeconds").notNull().default(10),
  referralCommissionPercent: int("referralCommissionPercent").notNull().default(50),
  websiteName: varchar("websiteName", { length: 80 }).notNull().default("Ads Earning"),
  themeName: mysqlEnum("themeName", ["green", "blue", "dark", "white"]).notNull().default("green"),
  logoUrl: varchar("logoUrl", { length: 1024 }),
  logoKey: varchar("logoKey", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/rules.ts
var WITHDRAWAL_LOCK_MESSAGE = "Please invite someone. When your invited user buys a package, 50% of his package price will be added to your withdraw limit.";
var WITHDRAWAL_NO_PACKAGE_MESSAGE = "Withdrawal requires an active package before referral withdrawal access can be displayed.";
var AD_TIMER_MESSAGE = "Please wait for the 10-second timer before claiming this reward.";
var AD_REWARD_PKR = 20;
var DESIGNATED_ADMIN_EMAIL = "muhammaddanyal4545@gmail.com";
var DESIGNATED_ADMIN_USERNAME = "danyal955163";
function toPkr(amount, currency, exchangeRate) {
  return currency === "PKR" ? Math.round(amount) : Math.round(amount * exchangeRate);
}
function fromPkr(amountPkr, exchangeRate) {
  return Number((amountPkr / exchangeRate).toFixed(2));
}
function referralLimitCredit(packagePricePkr, commissionPercent) {
  return Math.floor(packagePricePkr * commissionPercent / 100);
}
function applyWithdrawalRequest(balancePkr, amountPkr) {
  return { balancePkr: balancePkr - amountPkr, withdrawalLimitPkr: 0 };
}
function refundRejectedWithdrawal(balancePkr, amountPkr) {
  return balancePkr + amountPkr;
}
function validateWithdrawalRequest(input) {
  if (input.withdrawalLimitPkr < 50)
    return input.activePackage === false ? WITHDRAWAL_NO_PACKAGE_MESSAGE : WITHDRAWAL_LOCK_MESSAGE;
  if (input.amountPkr < input.minimumWithdrawalPkr || input.amountPkr > input.maximumWithdrawalPkr) {
    return `Withdrawal amount must be between PKR ${input.minimumWithdrawalPkr} and PKR ${input.maximumWithdrawalPkr}.`;
  }
  if (input.amountPkr > input.withdrawalLimitPkr)
    return `Your current withdrawal limit is PKR ${input.withdrawalLimitPkr}. Invite friends to unlock more withdrawal limit.`;
  if (input.amountPkr > input.balancePkr)
    return "Your wallet balance is insufficient for this withdrawal request.";
  return null;
}
function canClaimAd(startedAt, now, timerSeconds) {
  return now.getTime() >= startedAt.getTime() + timerSeconds * 1e3;
}
function getAdClaimStatus(input) {
  return canClaimAd(input.startedAt, input.now, input.timerSeconds) ? "claimable" : "early";
}
function isDesignatedAdministrator(email, username) {
  return email?.toLowerCase() === DESIGNATED_ADMIN_EMAIL && username === DESIGNATED_ADMIN_USERNAME;
}
function canUseMemberWorkspace(isBlocked) {
  return !isBlocked;
}
var DEPOSIT_MIN_PKR = 100;
var DEPOSIT_MAX_PKR = 5e3;
function validateDepositAmountPkr(amountPkr) {
  if (amountPkr < DEPOSIT_MIN_PKR || amountPkr > DEPOSIT_MAX_PKR)
    return `Deposit Limit: ${DEPOSIT_MIN_PKR} PKR to ${DEPOSIT_MAX_PKR} PKR.`;
  return null;
}

// shared/adRules.ts
var PAKISTAN_TIME_ZONE = "Asia/Karachi";
var PAKISTAN_UTC_OFFSET_MS = 5 * 60 * 60 * 1e3;
function pakistanDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PAKISTAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (name) => Number(parts.find((part) => part.type === name)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}
function getPakistanDayKey(date = /* @__PURE__ */ new Date()) {
  const { year, month, day } = pakistanDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function getNextPakistanMidnight(date = /* @__PURE__ */ new Date()) {
  const { year, month, day } = pakistanDateParts(date);
  return new Date(Date.UTC(year, month - 1, day + 1) - PAKISTAN_UTC_OFFSET_MS);
}
function getDailyAdQuota(packagePricePkr) {
  return Math.max(0, Math.floor(packagePricePkr / 100));
}
function getDailyAdStates(adIds, quota, watchedAdIds) {
  return adIds.map((id, index2) => ({
    id,
    state: watchedAdIds.has(id) ? "watched" : index2 < quota ? "unlocked" : "locked"
  }));
}

// server/db.ts
var _db = null;
var ADMIN_EMAIL = DESIGNATED_ADMIN_EMAIL;
var ADMIN_USERNAME = DESIGNATED_ADMIN_USERNAME;
var defaultPackages = [
  { tier: "bronze", name: "Bronze", icon: "\u{1F949}", pricePkr: 100, dailyAds: 1 },
  { tier: "silver", name: "Silver", icon: "\u{1F948}", pricePkr: 200, dailyAds: 2 },
  { tier: "gold", name: "Gold", icon: "\u{1F947}", pricePkr: 500, dailyAds: 5 },
  {
    tier: "platinum",
    name: "Platinum",
    icon: "\u{1F48E}",
    pricePkr: 1e3,
    dailyAds: 10
  },
  {
    tier: "diamond",
    name: "Diamond",
    icon: "\u{1F4A0}",
    pricePkr: 2e3,
    dailyAds: 20
  },
  { tier: "vip", name: "VIP", icon: "\u{1F451}", pricePkr: 5e3, dailyAds: 50 }
];
var defaultAccounts = [
  {
    currency: "PKR",
    provider: "JazzCash / JazzChain",
    accountName: "Muhammad Danyal",
    accountDetails: "03269337570"
  },
  {
    currency: "PKR",
    provider: "Nayapay",
    accountName: "Muhammad Danyal",
    accountDetails: "03311332670"
  },
  {
    currency: "PKR",
    provider: "Opay",
    accountName: "Muhammad Danyal",
    accountDetails: "03311332670"
  },
  {
    currency: "USD",
    provider: "USD payment account",
    accountName: "Configure in Admin Panel",
    accountDetails: "Add account number, code, or address in Admin Panel"
  }
];
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = {
    openId: user.openId,
    lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date()
  };
  const updateSet = {
    lastSignedIn: values.lastSignedIn
  };
  ["name", "email", "loginMethod"].forEach((field) => {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.openId === ENV.ownerOpenId ? "admin" : user.role ?? "user";
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}
async function linkOAuthUser(user) {
  if (!user.openId) throw new Error("OAuth openId is required");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email = user.email && user.emailVerified ? user.email.toLowerCase() : null;
  const existingByOpenId = (await db.select().from(users).where(eq(users.openId, user.openId)).limit(1))[0];
  const existingByEmail = email ? (await db.select().from(users).where(eq(users.email, email)).limit(1))[0] : void 0;
  const existing = existingByOpenId ?? existingByEmail;
  if (existing) {
    await db.update(users).set({
      openId: user.openId,
      name: user.name ?? existing.name,
      email: email ?? existing.email,
      loginMethod: user.loginMethod ?? existing.loginMethod,
      lastSignedIn: /* @__PURE__ */ new Date()
    }).where(eq(users.id, existing.id));
    return existing.id;
  }
  await upsertUser({ ...user, email, lastSignedIn: /* @__PURE__ */ new Date() });
  const created = (await db.select().from(users).where(eq(users.openId, user.openId)).limit(1))[0];
  if (!created) throw new Error("OAuth account linking failed");
  return created.id;
}
async function ensurePlatformData() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const settings = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!settings[0]) await db.insert(appSettings).values({ id: 1 });
  for (const item of defaultPackages) {
    const existing = await db.select({ id: packages.id }).from(packages).where(eq(packages.tier, item.tier)).limit(1);
    if (!existing[0])
      await db.insert(packages).values({ ...item, durationDays: 30, isActive: true });
  }
  const existingAccounts = await db.select({ id: paymentAccounts.id }).from(paymentAccounts).limit(1);
  if (!existingAccounts[0])
    await db.insert(paymentAccounts).values(defaultAccounts);
  for (const item of defaultPackages) {
    const existing = await db.select({ id: ads.id }).from(ads).where(and(eq(ads.packageTier, item.tier), eq(ads.isActive, true))).limit(1);
    if (!existing[0]) {
      await db.insert(ads).values({
        packageTier: item.tier,
        title: `${item.name} daily opportunity`,
        contentType: "text",
        content: "Read this sponsored opportunity until the reward timer completes.",
        isActive: true
      });
    }
  }
}
async function ensureProfile(user) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensurePlatformData();
  const current = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (current[0]) return current[0];
  const isDesignated = user.email?.toLowerCase() === ADMIN_EMAIL;
  const baseUsername = isDesignated ? ADMIN_USERNAME : `member${user.id}`;
  const referralCode = `PEP${user.id.toString(36).toUpperCase()}`;
  await db.insert(profiles).values({
    userId: user.id,
    username: baseUsername,
    referralCode,
    balancePkr: 0,
    withdrawalLimitPkr: 0
  });
  const created = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!created[0]) throw new Error("Profile creation failed");
  return created[0];
}
function isDesignatedAdmin(user, profile) {
  return isDesignatedAdministrator(user.email, profile.username);
}
function getDayKey(date = /* @__PURE__ */ new Date()) {
  return getPakistanDayKey(date);
}
async function getSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensurePlatformData();
  const row = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!row[0]) throw new Error("Settings unavailable");
  return row[0];
}
async function getActivePackageForUser(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = /* @__PURE__ */ new Date();
  const rows = await db.select({ ownership: userPackages, plan: packages }).from(userPackages).innerJoin(packages, eq(userPackages.packageId, packages.id)).where(and(eq(userPackages.userId, userId))).orderBy(desc(userPackages.expiresAt));
  return rows.find((row) => row.ownership.expiresAt > now && row.plan.isActive) ?? null;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret2 = ENV.cookieSecret;
    return new TextEncoder().encode(secret2);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        const rawUserInfo = userInfo;
        const emailVerified = rawUserInfo.emailVerified === true || rawUserInfo.email_verified === true || rawUserInfo.verifiedEmail === true;
        await linkOAuthUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          emailVerified,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      const rawUserInfo = userInfo;
      const emailVerified = rawUserInfo.emailVerified === true || rawUserInfo.email_verified === true || rawUserInfo.verifiedEmail === true;
      await linkOAuthUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        emailVerified,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { and as and2, desc as desc2, eq as eq2, inArray, sql } from "drizzle-orm";
import { randomUUID as randomUUID2 } from "node:crypto";
import { z as z2 } from "zod";

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/security.ts
import { createHash, randomInt, randomUUID } from "node:crypto";

// shared/humanVerification.ts
var HUMAN_IMAGE_OPTIONS = [
  { id: "apple", label: "Apple", emoji: "\u{1F34E}" },
  { id: "car", label: "Car", emoji: "\u{1F697}" },
  { id: "house", label: "House", emoji: "\u{1F3E0}" },
  { id: "star", label: "Star", emoji: "\u2B50" }
];
function humanImagePrompt(optionId) {
  const option = HUMAN_IMAGE_OPTIONS.find((item) => item.id === optionId);
  return `Select the ${option?.label ?? "Apple"} image.`;
}

// server/security.ts
function hashSecurityValue(value) {
  return createHash("sha256").update(value.trim()).digest("hex");
}
function clientIpFromHeaders(headers) {
  const forwarded = headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(",")[0]?.trim() || "unknown-network").slice(0, 128);
}
function createHumanChallenge() {
  const selected = HUMAN_IMAGE_OPTIONS[randomInt(0, HUMAN_IMAGE_OPTIONS.length)];
  return {
    id: randomUUID(),
    prompt: humanImagePrompt(selected.id),
    answerHash: hashSecurityValue(selected.id),
    expiresAt: new Date(Date.now() + 5 * 6e4)
  };
}
function matchesHumanChallenge(answer, answerHash) {
  return hashSecurityValue(answer) === answerHash;
}

// server/telegram.ts
var TELEGRAM_MESSAGE_LIMIT = 4096;
async function sendTelegramAlert(message) {
  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;
  if (!token || !chatId) {
    console.warn("[Telegram] Alert skipped because Telegram credentials are not configured.");
    return false;
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.slice(0, TELEGRAM_MESSAGE_LIMIT)
        }),
        signal: AbortSignal.timeout(1e4)
      }
    );
    if (!response.ok) {
      console.error(`[Telegram] Alert delivery failed with status ${response.status}.`);
      return false;
    }
    const payload = await response.json().catch(() => null);
    return payload?.ok === true;
  } catch (error) {
    console.error("[Telegram] Alert delivery failed.", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/localAuth.ts
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT as SignJWT2, jwtVerify as jwtVerify2 } from "jose";
var scrypt = promisify(scryptCallback);
var LOCAL_SESSION_COOKIE = "pep_local_session";
var encoder = new TextEncoder();
function secret() {
  if (!ENV.cookieSecret) throw new Error("Session signing is not configured.");
  return encoder.encode(ENV.cookieSecret);
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
async function verifyPassword(password, savedHash) {
  if (!savedHash) return false;
  const [algorithm, salt, expected] = savedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
}
async function createLocalSession(userId) {
  return new SignJWT2({ localUserId: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
}
async function readLocalSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify2(token, secret());
    const userId = payload.localUserId;
    return typeof userId === "number" && Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}

// server/routers.ts
function fail(message, code = "BAD_REQUEST") {
  throw new TRPCError3({ code, message });
}
function publicUser(user) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { ...safeUser, hasPassword: Boolean(_passwordHash) };
}
async function getActor(ctx) {
  const user = ctx.user;
  const profile = await ensureProfile(user);
  if (!canUseMemberWorkspace(profile.isBlocked))
    fail(
      "Your account is currently restricted. Please contact support.",
      "FORBIDDEN"
    );
  return { user, profile };
}
async function getAdmin(ctx) {
  const actor = await getActor(ctx);
  if (!isDesignatedAdmin(actor.user, actor.profile))
    fail("Administrator access is restricted.", "FORBIDDEN");
  return actor;
}
async function saveUpload(userId, raw, category) {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) fail("Please upload a valid image file.");
  const [, contentType, base64] = match;
  if (!contentType.startsWith("image/"))
    fail("Only image uploads are supported.");
  const file = Buffer.from(base64, "base64");
  if (file.length === 0 || file.length > 5 * 1024 * 1024)
    fail("Image upload must be between 1 byte and 5 MB.");
  const extension = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  const key = `package-earn-pro/${category}/${userId}/${Date.now()}.${extension}`;
  return storagePut(key, file, contentType);
}
async function saveAdMedia(userId, raw, contentType) {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) fail("Please upload a valid ad media file.");
  const [, mimeType, base64] = match;
  if (contentType === "image" && !mimeType.startsWith("image/"))
    fail("Image ads require an image upload.");
  if (contentType === "video" && !mimeType.startsWith("video/"))
    fail("Video ads require a video upload.");
  const file = Buffer.from(base64, "base64");
  if (file.length === 0 || file.length > 25 * 1024 * 1024)
    fail("Ad media must be between 1 byte and 25 MB.");
  const extension = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || (contentType === "video" ? "mp4" : "png");
  return storagePut(
    `package-earn-pro/ad-media/${userId}/${Date.now()}.${extension}`,
    file,
    mimeType
  );
}
async function consumeHumanChallenge(db, input) {
  const deviceFingerprintHash = hashSecurityValue(input.deviceId);
  const challenge = (await db.select().from(authChallenges).where(eq2(authChallenges.id, input.challengeId)).limit(1))[0];
  if (!challenge || challenge.purpose !== input.purpose || challenge.deviceFingerprintHash !== deviceFingerprintHash || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now() || !matchesHumanChallenge(input.challengeAnswer, challenge.answerHash))
    fail(
      "Human verification failed. Please solve the new check and try again.",
      "FORBIDDEN"
    );
  await db.update(authChallenges).set({ consumedAt: /* @__PURE__ */ new Date() }).where(eq2(authChallenges.id, challenge.id));
  return deviceFingerprintHash;
}
async function buildOverview(userId) {
  const db = await getDb();
  if (!db)
    fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
  const settings = await getSettings();
  const profile = (await db.select().from(profiles).where(eq2(profiles.userId, userId)).limit(1))[0];
  if (!profile) fail("Profile was not found.", "NOT_FOUND");
  const activePackage = await getActivePackageForUser(userId);
  const dayKey = getDayKey();
  const watchedRows = await db.select({ count: sql`count(*)` }).from(adSessions).where(
    and2(
      eq2(adSessions.userId, userId),
      eq2(adSessions.dayKey, dayKey),
      sql`${adSessions.claimedAt} IS NOT NULL`
    )
  );
  const totalEarned = await db.select({ total: sql`coalesce(sum(${transactions.amountPkr}), 0)` }).from(transactions).where(
    and2(
      eq2(transactions.userId, userId),
      eq2(transactions.type, "ad_reward"),
      eq2(transactions.direction, "credit")
    )
  );
  const daysRemaining = activePackage ? Math.max(
    0,
    Math.ceil(
      (activePackage.ownership.expiresAt.getTime() - Date.now()) / 864e5
    )
  ) : 0;
  const activeAdRows = await db.select({ id: ads.id }).from(ads).where(eq2(ads.isActive, true)).orderBy(ads.id);
  const dailyQuota = activePackage ? getDailyAdQuota(activePackage.plan.pricePkr) : 0;
  return {
    profile,
    settings,
    activePackage: activePackage ? {
      ...activePackage.plan,
      ownershipId: activePackage.ownership.id,
      expiresAt: activePackage.ownership.expiresAt,
      daysRemaining
    } : null,
    todayAds: {
      watched: Number(watchedRows[0]?.count ?? 0),
      total: Math.min(dailyQuota, activeAdRows.length),
      resetAt: getNextPakistanMidnight()
    },
    totalEarnedPkr: Number(totalEarned[0]?.total ?? 0)
  };
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(
      (opts) => opts.ctx.user ? publicUser(opts.ctx.user) : null
    ),
    captcha: publicProcedure.input(
      z2.object({
        purpose: z2.enum(["sign_in", "sign_up"]),
        deviceId: z2.string().trim().min(16).max(256)
      })
    ).query(async ({ input }) => {
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
        expiresAt: challenge.expiresAt
      });
      return {
        id: challenge.id,
        prompt: challenge.prompt,
        expiresAt: challenge.expiresAt
      };
    }),
    register: publicProcedure.input(
      z2.object({
        username: z2.string().trim().min(3).max(32).regex(
          /^[a-zA-Z0-9_]+$/,
          "Use letters, numbers, and underscores only."
        ),
        email: z2.string().trim().email("Enter a valid Gmail or email address.").max(320),
        password: z2.string().min(8, "Password must be at least 8 characters.").max(128),
        referralCode: z2.string().trim().max(32).optional(),
        challengeId: z2.string().uuid(),
        challengeAnswer: z2.string().trim().min(1).max(32),
        deviceId: z2.string().trim().min(16).max(256)
      })
    ).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const email = input.email.toLowerCase();
      const username = input.username.toLowerCase();
      const deviceFingerprintHash = await consumeHumanChallenge(db, {
        challengeId: input.challengeId,
        challengeAnswer: input.challengeAnswer,
        deviceId: input.deviceId,
        purpose: "sign_up"
      });
      const registrationIpHash = hashSecurityValue(
        clientIpFromHeaders(
          ctx.req.headers
        )
      );
      const isDesignated = email === ADMIN_EMAIL && username === "danyal955163";
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
      const [emailMatch, usernameMatch, deviceMatch, networkMatch] = await Promise.all([
        db.select({ id: users.id }).from(users).where(eq2(users.email, email)).limit(1),
        db.select({ id: profiles.id }).from(profiles).where(eq2(profiles.username, username)).limit(1),
        db.select({ id: users.id }).from(users).where(eq2(users.deviceFingerprintHash, deviceFingerprintHash)).limit(1),
        db.select({ id: users.id }).from(users).where(eq2(users.registrationIpHash, registrationIpHash)).limit(1)
      ]);
      if (emailMatch[0])
        fail("An account already exists for this email address.", "CONFLICT");
      if (usernameMatch[0])
        fail("That username is already in use.", "CONFLICT");
      if (deviceMatch[0] || networkMatch[0])
        fail("Only one account per device or network is allowed.", "FORBIDDEN");
      let referredByUserId = null;
      if (input.referralCode) {
        const referralValue = input.referralCode.trim();
        let referrer = (await db.select().from(profiles).where(eq2(profiles.referralCode, referralValue.toUpperCase())).limit(1))[0];
        if (!referrer)
          referrer = (await db.select().from(profiles).where(eq2(profiles.username, referralValue.toLowerCase())).limit(1))[0];
        if (!referrer) fail("Referral code or username was not found.");
        referredByUserId = referrer.userId;
      }
      const created = await db.insert(users).values({
        openId: `local_${randomUUID2()}`,
        name: username,
        email,
        passwordHash: await hashPassword(input.password),
        deviceFingerprintHash,
        registrationIpHash,
        loginMethod: "password",
        role: isDesignated ? "admin" : "user",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const userId = Number(created[0].insertId);
      await db.insert(profiles).values({
        userId,
        username,
        referralCode: `PEP${userId.toString(36).toUpperCase()}`,
        referredByUserId,
        balancePkr: 0,
        withdrawalLimitPkr: 0,
        preferredCurrency: "PKR"
      });
      const user = (await db.select().from(users).where(eq2(users.id, userId)).limit(1))[0];
      if (!user) fail("Account creation failed.", "INTERNAL_SERVER_ERROR");
      ctx.res.cookie(
        LOCAL_SESSION_COOKIE,
        await createLocalSession(user.id),
        {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1e3
        }
      );
      return { user: publicUser(user) };
    }),
    signIn: publicProcedure.input(
      z2.object({
        email: z2.string().trim().email("Enter a valid Gmail or email address.").max(320),
        password: z2.string().min(1, "Enter your password."),
        challengeId: z2.string().uuid(),
        challengeAnswer: z2.string().trim().min(1).max(32),
        deviceId: z2.string().trim().min(16).max(256)
      })
    ).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await consumeHumanChallenge(db, {
        challengeId: input.challengeId,
        challengeAnswer: input.challengeAnswer,
        deviceId: input.deviceId,
        purpose: "sign_in"
      });
      const user = (await db.select().from(users).where(eq2(users.email, input.email.toLowerCase())).limit(1))[0];
      if (!user || !await verifyPassword(input.password, user.passwordHash))
        fail("Incorrect email or password.", "UNAUTHORIZED");
      const profile = await ensureProfile(user);
      if (profile.isBlocked)
        fail(
          "Your account is currently restricted. Please contact support.",
          "FORBIDDEN"
        );
      await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
      ctx.res.cookie(
        LOCAL_SESSION_COOKIE,
        await createLocalSession(user.id),
        {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1e3
        }
      );
      return { user: publicUser(user) };
    }),
    setPassword: protectedProcedure.input(
      z2.object({
        password: z2.string().min(8, "Password must be at least 8 characters.").max(128)
      })
    ).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(users).set({
        passwordHash: await hashPassword(input.password),
        loginMethod: "password"
      }).where(eq2(users.id, ctx.user.id));
      ctx.res.cookie(
        LOCAL_SESSION_COOKIE,
        await createLocalSession(ctx.user.id),
        {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1e3
        }
      );
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1
      });
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1
      });
      return { success: true };
    })
  }),
  account: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      return {
        user: publicUser(user),
        profile,
        isAdmin: isDesignatedAdmin(user, profile)
      };
    }),
    saveProfile: protectedProcedure.input(
      z2.object({
        username: z2.string().trim().min(3).max(32).regex(
          /^[a-zA-Z0-9_]+$/,
          "Use letters, numbers, and underscores only."
        ),
        referralCode: z2.string().trim().max(32).optional(),
        preferredCurrency: z2.enum(["PKR", "USD"])
      })
    ).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const requestedName = input.username.toLowerCase();
      if (requestedName === "danyal955163" && user.email?.toLowerCase() !== ADMIN_EMAIL)
        fail(
          "This username is reserved for the designated administrator.",
          "FORBIDDEN"
        );
      const duplicate = await db.select().from(profiles).where(eq2(profiles.username, requestedName)).limit(1);
      if (duplicate[0] && duplicate[0].userId !== user.id)
        fail("That username is already in use.");
      let referredByUserId = profile.referredByUserId;
      if (input.referralCode && !referredByUserId) {
        const referralValue = input.referralCode.trim();
        let referrer = (await db.select().from(profiles).where(eq2(profiles.referralCode, referralValue.toUpperCase())).limit(1))[0];
        if (!referrer)
          referrer = (await db.select().from(profiles).where(eq2(profiles.username, referralValue.toLowerCase())).limit(1))[0];
        if (!referrer) fail("Referral code or username was not found.");
        if (referrer.userId === user.id)
          fail("You cannot use your own referral code.");
        referredByUserId = referrer.userId;
      }
      if (isDesignatedAdmin(user, profile) && requestedName !== "danyal955163")
        fail("The designated administrator username cannot be changed.");
      await db.update(profiles).set({
        username: requestedName,
        preferredCurrency: input.preferredCurrency,
        referredByUserId
      }).where(eq2(profiles.userId, user.id));
      return { success: true };
    })
  }),
  platform: router({
    publicData: publicProcedure.query(async () => {
      await ensurePlatformData();
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const settings = await getSettings();
      return {
        packages: await db.select().from(packages).where(eq2(packages.isActive, true)),
        branding: {
          websiteName: settings.websiteName,
          themeName: settings.themeName,
          logoUrl: settings.logoUrl
        }
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
      return db.select().from(broadcasts).orderBy(desc2(broadcasts.createdAt)).limit(10);
    }),
    joinWhatsApp: protectedProcedure.mutation(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (profile.whatsappJoined || profile.whatsappBonusClaimed)
        return { success: true, bonusPkr: 0, alreadyJoined: true };
      await db.update(profiles).set({
        whatsappJoined: true,
        whatsappBonusClaimed: true,
        balancePkr: profile.balancePkr + 30
      }).where(eq2(profiles.userId, user.id));
      await db.insert(transactions).values({
        userId: user.id,
        type: "adjustment",
        direction: "credit",
        amountPkr: 30,
        status: "completed",
        note: "WhatsApp Channel join bonus",
        referenceType: "whatsapp_bonus",
        referenceId: user.id
      });
      return { success: true, bonusPkr: 30, alreadyJoined: false };
    })
  }),
  package: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await ensurePlatformData();
      return db.select().from(packages).where(eq2(packages.isActive, true));
    }),
    buy: protectedProcedure.input(z2.object({ packageId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const plan = (await db.select().from(packages).where(
        and2(eq2(packages.id, input.packageId), eq2(packages.isActive, true))
      ).limit(1))[0];
      if (!plan) fail("That package is not available.", "NOT_FOUND");
      if (profile.balancePkr < plan.pricePkr)
        fail(
          "Your wallet balance is insufficient. Please deposit funds first."
        );
      const now = /* @__PURE__ */ new Date();
      const expiresAt = new Date(
        now.getTime() + plan.durationDays * 864e5
      );
      await db.update(profiles).set({ balancePkr: profile.balancePkr - plan.pricePkr }).where(eq2(profiles.userId, user.id));
      await db.insert(userPackages).values({
        userId: user.id,
        packageId: plan.id,
        purchasedAt: now,
        expiresAt
      });
      await db.insert(transactions).values({
        userId: user.id,
        type: "package",
        direction: "debit",
        amountPkr: plan.pricePkr,
        status: "completed",
        note: `${plan.name} package purchased`
      });
      if (profile.referredByUserId) {
        const settings = await getSettings();
        const credit = referralLimitCredit(
          plan.pricePkr,
          settings.referralCommissionPercent
        );
        const referrer = (await db.select().from(profiles).where(eq2(profiles.userId, profile.referredByUserId)).limit(1))[0];
        if (referrer) {
          await db.update(profiles).set({ withdrawalLimitPkr: referrer.withdrawalLimitPkr + credit }).where(eq2(profiles.userId, referrer.userId));
          await db.insert(transactions).values({
            userId: referrer.userId,
            type: "referral_limit",
            direction: "neutral",
            amountPkr: credit,
            status: "completed",
            note: `Referral withdrawal limit unlocked by ${plan.name} purchase`
          });
        }
      }
      return { success: true, expiresAt };
    })
  }),
  wallet: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const data = await buildOverview(user.id);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const recent = await db.select().from(transactions).where(eq2(transactions.userId, user.id)).orderBy(desc2(transactions.createdAt)).limit(5);
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
        )
      };
    }),
    transactions: protectedProcedure.input(
      z2.object({
        type: z2.enum([
          "all",
          "deposit",
          "package",
          "ad_reward",
          "withdrawal",
          "referral_limit",
          "adjustment"
        ]).default("all"),
        status: z2.enum(["all", "pending", "approved", "rejected", "completed"]).default("all")
      })
    ).query(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const rows = await db.select().from(transactions).where(eq2(transactions.userId, user.id)).orderBy(desc2(transactions.createdAt));
      return rows.filter(
        (row) => (input.type === "all" || row.type === input.type) && (input.status === "all" || row.status === input.status)
      );
    })
  }),
  earning: router({
    ads: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [activePackage, activeAds] = await Promise.all([
        getActivePackageForUser(user.id),
        db.select().from(ads).where(eq2(ads.isActive, true)).orderBy(ads.id)
      ]);
      const dayKey = getDayKey();
      const sessions = await db.select().from(adSessions).where(
        and2(eq2(adSessions.userId, user.id), eq2(adSessions.dayKey, dayKey))
      );
      const watchedAdIds = new Set(
        sessions.filter((session) => session.claimedAt).map((session) => session.adId)
      );
      const quota = activePackage ? getDailyAdQuota(activePackage.plan.pricePkr) : 0;
      const stateById = new Map(
        getDailyAdStates(
          activeAds.map((ad) => ad.id),
          quota,
          watchedAdIds
        ).map((item) => [item.id, item.state])
      );
      return {
        ads: activeAds.map((ad) => ({
          ...ad,
          state: stateById.get(ad.id) ?? "locked"
        })),
        watched: watchedAdIds.size,
        total: Math.min(quota, activeAds.length),
        resetAt: getNextPakistanMidnight(),
        activePackage: activePackage ? {
          name: activePackage.plan.name,
          pricePkr: activePackage.plan.pricePkr,
          quota
        } : null
      };
    }),
    startAd: protectedProcedure.input(z2.object({ adId: z2.number().int().positive() }).optional()).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (!input) fail("Select an unlocked ad to begin.");
      const active = await getActivePackageForUser(user.id);
      if (!active)
        fail("Please purchase an active package to start earning.");
      const dayKey = getDayKey();
      const activeAds = await db.select().from(ads).where(eq2(ads.isActive, true)).orderBy(ads.id);
      const sessions = await db.select().from(adSessions).where(
        and2(eq2(adSessions.userId, user.id), eq2(adSessions.dayKey, dayKey))
      );
      const watchedAdIds = new Set(
        sessions.filter((session) => session.claimedAt).map((session) => session.adId)
      );
      const quota = getDailyAdQuota(active.plan.pricePkr);
      const stateById = new Map(
        getDailyAdStates(
          activeAds.map((ad) => ad.id),
          quota,
          watchedAdIds
        ).map((item) => [item.id, item.state])
      );
      const available = activeAds.find((ad) => ad.id === input.adId);
      if (!available || stateById.get(available.id) !== "unlocked")
        fail(
          "This ad is locked or has already been watched today.",
          "FORBIDDEN"
        );
      if (sessions.some(
        (session) => session.adId === available.id && !session.claimedAt && !session.invalidatedAt
      ))
        fail(
          "This ad is already open. Complete it or wait for it to expire.",
          "CONFLICT"
        );
      const startedAt = /* @__PURE__ */ new Date();
      const result = await db.insert(adSessions).values({
        userId: user.id,
        userPackageId: active.ownership.id,
        adId: available.id,
        dayKey,
        startedAt,
        lastHeartbeatAt: startedAt,
        rewardPkr: AD_REWARD_PKR
      });
      const settings = await getSettings();
      return {
        sessionId: Number(result[0].insertId),
        ad: available,
        startedAt,
        availableAt: new Date(
          startedAt.getTime() + settings.adTimerSeconds * 1e3
        ),
        timerSeconds: settings.adTimerSeconds
      };
    }),
    heartbeat: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const session = (await db.select().from(adSessions).where(
        and2(
          eq2(adSessions.id, input.sessionId),
          eq2(adSessions.userId, user.id)
        )
      ).limit(1))[0];
      if (!session || session.claimedAt || session.invalidatedAt)
        fail(AD_TIMER_MESSAGE, "FORBIDDEN");
      await db.update(adSessions).set({ lastHeartbeatAt: /* @__PURE__ */ new Date() }).where(eq2(adSessions.id, session.id));
      return { success: true };
    }),
    claimAd: protectedProcedure.input(z2.object({ sessionId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const session = (await db.select().from(adSessions).where(
        and2(
          eq2(adSessions.id, input.sessionId),
          eq2(adSessions.userId, user.id)
        )
      ).limit(1))[0];
      if (!session) fail("Earning session was not found.", "NOT_FOUND");
      if (session.claimedAt) fail("This reward has already been claimed.");
      const settings = await getSettings();
      const claimStatus = getAdClaimStatus({
        startedAt: session.startedAt,
        lastHeartbeatAt: session.lastHeartbeatAt,
        invalidatedAt: session.invalidatedAt,
        now: /* @__PURE__ */ new Date(),
        timerSeconds: settings.adTimerSeconds
      });
      if (claimStatus === "early") fail(AD_TIMER_MESSAGE);
      const profile = (await db.select().from(profiles).where(eq2(profiles.userId, user.id)).limit(1))[0];
      if (!profile) fail("Profile was not found.", "NOT_FOUND");
      await db.update(adSessions).set({ claimedAt: /* @__PURE__ */ new Date() }).where(eq2(adSessions.id, session.id));
      await db.update(profiles).set({ balancePkr: profile.balancePkr + session.rewardPkr }).where(eq2(profiles.userId, user.id));
      await db.insert(transactions).values({
        userId: user.id,
        type: "ad_reward",
        direction: "credit",
        amountPkr: session.rewardPkr,
        status: "completed",
        note: "Daily ad reward claimed"
      });
      return { success: true, rewardPkr: session.rewardPkr };
    })
  }),
  deposit: router({
    accounts: protectedProcedure.input(z2.object({ currency: z2.enum(["PKR", "USD"]) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(paymentAccounts).where(
        and2(
          eq2(paymentAccounts.currency, input.currency),
          eq2(paymentAccounts.isActive, true)
        )
      );
    }),
    create: protectedProcedure.input(
      z2.object({
        currency: z2.enum(["PKR", "USD"]),
        amount: z2.number().positive(),
        method: z2.string().trim().min(2).max(64),
        senderAccountNumber: z2.string().trim().min(4).max(256),
        senderAccountName: z2.string().trim().min(2).max(128),
        transactionId: z2.string().trim().min(3).max(128),
        requestedPackageId: z2.number().int().positive().optional(),
        proofData: z2.string().min(24)
      })
    ).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const settings = await getSettings();
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const receipt = await saveUpload(
        user.id,
        input.proofData,
        "deposit-proofs"
      );
      const convertedAmountPkr = toPkr(
        input.amount,
        input.currency,
        settings.exchangeRatePkrPerUsd
      );
      const isUsdAmountWithinDisplayedRange = input.currency === "USD" && input.amount >= 0.35 && input.amount <= 17.85;
      const depositError = isUsdAmountWithinDisplayedRange ? null : validateDepositAmountPkr(convertedAmountPkr);
      if (depositError) fail(depositError);
      const amountPkr = isUsdAmountWithinDisplayedRange ? Math.max(100, Math.min(5e3, convertedAmountPkr)) : convertedAmountPkr;
      const duplicateTransaction = (await db.select({ id: deposits.id }).from(deposits).where(eq2(deposits.transactionId, input.transactionId)).limit(1))[0];
      if (duplicateTransaction)
        fail("This transaction ID has already been submitted.", "CONFLICT");
      if (input.requestedPackageId) {
        const requestedPackage = (await db.select({ id: packages.id }).from(packages).where(eq2(packages.id, input.requestedPackageId)).limit(1))[0];
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
        proofUrl: receipt.url,
        proofKey: receipt.key,
        status: "pending"
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
        referenceId: depositId
      });
      void sendTelegramAlert(
        [
          "\u{1F4B0} NEW DEPOSIT",
          `\u{1F464} User: ${profile.username} (ID:${user.id})`,
          `\u{1F4B5} Amount: ${amountPkr} PKR`,
          `\u{1F194} TRX: ${input.transactionId}`,
          `\u{1F4F1} From: ${input.senderAccountNumber}`
        ].join("\n")
      );
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(deposits).where(eq2(deposits.userId, user.id)).orderBy(desc2(deposits.createdAt));
    })
  }),
  withdrawal: router({
    create: protectedProcedure.input(
      z2.object({
        currency: z2.enum(["PKR", "USD"]),
        amount: z2.number().positive(),
        accountName: z2.string().trim().min(2).max(128),
        accountDetails: z2.string().trim().min(4).max(512)
      })
    ).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const settings = await getSettings();
      const amountPkr = toPkr(
        input.amount,
        input.currency,
        settings.exchangeRatePkrPerUsd
      );
      if (amountPkr < 50 || amountPkr > 3e3)
        fail("Withdraw Limit: 50 PKR to 3000 PKR.");
      const activePackage = Boolean(await getActivePackageForUser(user.id));
      const withdrawalError = validateWithdrawalRequest({
        balancePkr: profile.balancePkr,
        withdrawalLimitPkr: profile.withdrawalLimitPkr,
        amountPkr,
        minimumWithdrawalPkr: settings.minimumWithdrawalPkr,
        maximumWithdrawalPkr: settings.maximumWithdrawalPkr,
        activePackage
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
        status: "pending"
      });
      const withdrawalId = Number(result[0].insertId);
      const reserved = applyWithdrawalRequest(profile.balancePkr, amountPkr);
      await db.update(profiles).set({
        balancePkr: reserved.balancePkr,
        withdrawalLimitPkr: reserved.withdrawalLimitPkr
      }).where(eq2(profiles.userId, user.id));
      await db.insert(transactions).values({
        userId: user.id,
        type: "withdrawal",
        direction: "debit",
        amountPkr,
        status: "pending",
        note: "Withdrawal request awaiting approval; wallet amount reserved",
        referenceType: "withdrawal",
        referenceId: withdrawalId
      });
      void sendTelegramAlert(
        [
          "\u{1F4B8} WITHDRAW REQUEST",
          `\u{1F464} User: ${profile.username}`,
          `\u{1F4B5} Amount: ${input.amount} ${input.currency}`,
          `\u{1F4F1} Easypaisa/JazzCash: ${input.accountDetails}`
        ].join("\n")
      );
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(withdrawals).where(eq2(withdrawals.userId, user.id)).orderBy(desc2(withdrawals.createdAt));
    })
  }),
  referral: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const referrals = await db.select({
        userId: profiles.userId,
        username: profiles.username,
        createdAt: profiles.createdAt
      }).from(profiles).where(eq2(profiles.referredByUserId, user.id));
      const purchaserRows = referrals.length ? await db.select({ userId: userPackages.userId }).from(userPackages).where(
        inArray(
          userPackages.userId,
          referrals.map((referral) => referral.userId)
        )
      ) : [];
      const purchasers = new Set(purchaserRows.map((row) => row.userId));
      return {
        username: profile.username,
        referralCode: profile.referralCode,
        totalReferrals: referrals.length,
        purchasedReferrals: purchasers.size,
        withdrawalLimitPkr: profile.withdrawalLimitPkr,
        referrals
      };
    })
  }),
  support: router({
    create: protectedProcedure.input(
      z2.object({
        subject: z2.string().trim().min(3).max(140),
        description: z2.string().trim().min(10).max(5e3),
        screenshotData: z2.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const { user, profile } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const upload = input.screenshotData ? await saveUpload(user.id, input.screenshotData, "support") : null;
      await db.insert(supportTickets).values({
        userId: user.id,
        subject: input.subject,
        description: input.description,
        screenshotUrl: upload?.url,
        screenshotKey: upload?.key,
        status: "open"
      });
      void sendTelegramAlert(
        [
          "\u{1F198} SUPPORT",
          `\u{1F464} User: ${profile.username}`,
          `\u2753 Msg: ${input.description}`,
          `\u{1F4E7} Email: ${user.email ?? "Not provided"}`
        ].join("\n")
      );
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const { user } = await getActor(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(supportTickets).where(eq2(supportTickets.userId, user.id)).orderBy(desc2(supportTickets.updatedAt));
    })
  }),
  admin: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [pendingDeposits, pendingWithdrawals, openTickets, userCount] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(deposits).where(eq2(deposits.status, "pending")),
        db.select({ count: sql`count(*)` }).from(withdrawals).where(eq2(withdrawals.status, "pending")),
        db.select({ count: sql`count(*)` }).from(supportTickets).where(sql`${supportTickets.status} != 'resolved'`),
        db.select({ count: sql`count(*)` }).from(profiles)
      ]);
      return {
        pendingDeposits: Number(pendingDeposits[0]?.count ?? 0),
        pendingWithdrawals: Number(pendingWithdrawals[0]?.count ?? 0),
        openTickets: Number(openTickets[0]?.count ?? 0),
        userCount: Number(userCount[0]?.count ?? 0)
      };
    }),
    financialRequests: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const [depositRows, withdrawalRows, memberRows, packageRows, referralRows, activePackageRows] = await Promise.all([
        db.select().from(deposits).orderBy(desc2(deposits.createdAt)),
        db.select().from(withdrawals).orderBy(desc2(withdrawals.createdAt)),
        db.select({
          userId: users.id,
          email: users.email,
          username: profiles.username,
          balancePkr: profiles.balancePkr,
          withdrawalLimitPkr: profiles.withdrawalLimitPkr
        }).from(users).innerJoin(profiles, eq2(users.id, profiles.userId)),
        db.select({ id: packages.id, name: packages.name }).from(packages),
        db.select({ referredByUserId: profiles.referredByUserId }).from(profiles),
        db.select({ userId: userPackages.userId, packageName: packages.name }).from(userPackages).innerJoin(packages, eq2(userPackages.packageId, packages.id)).where(sql`${userPackages.expiresAt} > NOW()`)
      ]);
      const activePackageNames = new Map(
        activePackageRows.map((row) => [row.userId, row.packageName])
      );
      const members = new Map(
        memberRows.map((member) => [
          member.userId,
          { ...member, activePackageName: activePackageNames.get(member.userId) ?? null }
        ])
      );
      const packageNames = new Map(packageRows.map((plan) => [plan.id, plan.name]));
      const referralCounts = /* @__PURE__ */ new Map();
      referralRows.forEach((row) => {
        if (row.referredByUserId)
          referralCounts.set(
            row.referredByUserId,
            (referralCounts.get(row.referredByUserId) ?? 0) + 1
          );
      });
      return {
        deposits: depositRows.map((row) => ({
          ...row,
          member: members.get(row.userId) ?? null,
          requestedPackageName: row.requestedPackageId ? packageNames.get(row.requestedPackageId) ?? null : null
        })),
        withdrawals: withdrawalRows.map((row) => ({
          ...row,
          member: members.get(row.userId) ? {
            ...members.get(row.userId),
            referralCount: referralCounts.get(row.userId) ?? 0
          } : null
        }))
      };
    }),
    reviewDeposit: protectedProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        approved: z2.boolean(),
        note: z2.string().trim().max(512).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const deposit = (await db.select().from(deposits).where(eq2(deposits.id, input.id)).limit(1))[0];
      if (!deposit) fail("Deposit request was not found.", "NOT_FOUND");
      if (deposit.status !== "pending")
        fail("This deposit request has already been reviewed.");
      const status = input.approved ? "approved" : "rejected";
      await db.update(deposits).set({
        status,
        adminNote: input.note ?? null,
        reviewedAt: /* @__PURE__ */ new Date()
      }).where(eq2(deposits.id, deposit.id));
      await db.update(transactions).set({ status: input.approved ? "approved" : "rejected" }).where(
        and2(
          eq2(transactions.referenceType, "deposit"),
          eq2(transactions.referenceId, deposit.id),
          eq2(transactions.status, "pending")
        )
      );
      if (input.approved) {
        const profile = (await db.select().from(profiles).where(eq2(profiles.userId, deposit.userId)).limit(1))[0];
        if (profile)
          await db.update(profiles).set({ balancePkr: profile.balancePkr + deposit.amountPkr }).where(eq2(profiles.userId, deposit.userId));
      }
      return { success: true };
    }),
    reviewWithdrawal: protectedProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        approved: z2.boolean(),
        note: z2.string().trim().max(512).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const request = (await db.select().from(withdrawals).where(eq2(withdrawals.id, input.id)).limit(1))[0];
      if (!request) fail("Withdrawal request was not found.", "NOT_FOUND");
      if (request.status !== "pending")
        fail("This withdrawal request has already been reviewed.");
      const profile = (await db.select().from(profiles).where(eq2(profiles.userId, request.userId)).limit(1))[0];
      if (!profile) fail("The user's profile was not found.", "NOT_FOUND");
      if (!input.approved) {
        const refundedBalance = refundRejectedWithdrawal(
          profile.balancePkr,
          request.amountPkr
        );
        await db.update(profiles).set({
          balancePkr: refundedBalance,
          withdrawalLimitPkr: profile.withdrawalLimitPkr + request.amountPkr
        }).where(eq2(profiles.userId, request.userId));
      }
      await db.update(withdrawals).set({
        status: input.approved ? "approved" : "rejected",
        adminNote: input.note ?? null,
        reviewedAt: /* @__PURE__ */ new Date()
      }).where(eq2(withdrawals.id, request.id));
      await db.update(transactions).set({
        status: input.approved ? "approved" : "rejected",
        direction: input.approved ? "debit" : "neutral"
      }).where(
        and2(
          eq2(transactions.referenceType, "withdrawal"),
          eq2(transactions.referenceId, request.id),
          eq2(transactions.status, "pending")
        )
      );
      return { success: true };
    }),
    deleteDepositHistory: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const record = (await db.select().from(deposits).where(eq2(deposits.id, input.id)).limit(1))[0];
      if (!record) fail("Deposit history record was not found.", "NOT_FOUND");
      if (record.status === "pending")
        fail("Review this deposit before deleting its history.", "CONFLICT");
      await db.delete(deposits).where(eq2(deposits.id, record.id));
      return { success: true };
    }),
    deleteWithdrawalHistory: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const record = (await db.select().from(withdrawals).where(eq2(withdrawals.id, input.id)).limit(1))[0];
      if (!record) fail("Withdrawal history record was not found.", "NOT_FOUND");
      if (record.status === "pending")
        fail("Review this withdrawal before deleting its history.", "CONFLICT");
      await db.delete(withdrawals).where(eq2(withdrawals.id, record.id));
      return { success: true };
    }),
    users: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        profile: profiles
      }).from(users).innerJoin(profiles, eq2(users.id, profiles.userId)).orderBy(desc2(users.createdAt));
    }),
    userDetail: protectedProcedure.input(z2.object({ userId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const member = (await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        hasPassword: sql`case when ${users.passwordHash} is null then 0 else 1 end`,
        profile: profiles
      }).from(users).innerJoin(profiles, eq2(users.id, profiles.userId)).where(eq2(users.id, input.userId)).limit(1))[0];
      if (!member) fail("Member was not found.", "NOT_FOUND");
      const [memberDeposits, memberWithdrawals, memberTransactions, referrals] = await Promise.all([
        db.select().from(deposits).where(eq2(deposits.userId, input.userId)).orderBy(desc2(deposits.createdAt)),
        db.select().from(withdrawals).where(eq2(withdrawals.userId, input.userId)).orderBy(desc2(withdrawals.createdAt)),
        db.select().from(transactions).where(eq2(transactions.userId, input.userId)).orderBy(desc2(transactions.createdAt)),
        db.select({ count: sql`count(*)` }).from(profiles).where(eq2(profiles.referredByUserId, input.userId))
      ]);
      const activePackage = await getActivePackageForUser(input.userId);
      return {
        member: {
          ...member,
          passwordStatus: Number(member.hasPassword) ? "set" : "not_set",
          hasPassword: void 0
        },
        totals: {
          depositAmountPkr: memberDeposits.filter((row) => row.status === "approved").reduce((sum, row) => sum + row.amountPkr, 0),
          depositCount: memberDeposits.length,
          withdrawalAmountPkr: memberWithdrawals.filter((row) => row.status === "approved").reduce((sum, row) => sum + row.amountPkr, 0),
          withdrawalCount: memberWithdrawals.length,
          referralCount: Number(referrals[0]?.count ?? 0)
        },
        activePackage: activePackage ? { name: activePackage.plan.name, expiresAt: activePackage.ownership.expiresAt } : null,
        deposits: memberDeposits,
        withdrawals: memberWithdrawals,
        referralEarnings: memberTransactions.filter(
          (row) => row.type === "referral_limit"
        )
      };
    }),
    setBlocked: protectedProcedure.input(
      z2.object({ userId: z2.number().int().positive(), blocked: z2.boolean() })
    ).mutation(async ({ ctx, input }) => {
      const { user } = await getAdmin(ctx);
      if (input.userId === user.id)
        fail("The designated administrator cannot be blocked.");
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(profiles).set({ isBlocked: input.blocked }).where(eq2(profiles.userId, input.userId));
      return { success: true };
    }),
    ads: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(ads).orderBy(desc2(ads.updatedAt));
    }),
    saveAd: protectedProcedure.input(
      z2.object({
        id: z2.number().int().positive().optional(),
        packageTier: z2.string().min(3).max(24),
        title: z2.string().trim().min(3).max(128),
        contentType: z2.enum(["text", "image", "video", "link", "app"]),
        content: z2.string().trim().max(5e3).optional(),
        mediaData: z2.string().max(36e6).optional(),
        targetUrl: z2.string().url().optional(),
        isActive: z2.boolean()
      })
    ).mutation(async ({ ctx, input }) => {
      const { user } = await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (!input.id && input.contentType === "text")
        fail("New advertisements must use Image, Video, Link, or App Ad.");
      let content = input.content ?? "";
      if (input.mediaData) {
        if (input.contentType !== "image" && input.contentType !== "video")
          fail("Only image or video ad types accept gallery uploads.");
        content = (await saveAdMedia(user.id, input.mediaData, input.contentType)).url;
      }
      if ((input.contentType === "image" || input.contentType === "video") && !content)
        fail("Please upload media for this ad type.");
      if ((input.contentType === "link" || input.contentType === "app") && !input.targetUrl)
        fail("Please paste a destination link for this ad type.");
      const values = {
        packageTier: input.packageTier,
        title: input.title,
        contentType: input.contentType,
        content: content || input.targetUrl || "Custom advertisement",
        targetUrl: input.targetUrl ?? null,
        isActive: input.isActive
      };
      if (input.id) {
        await db.update(ads).set(values).where(eq2(ads.id, input.id));
      } else {
        await db.insert(ads).values(values);
      }
      return { success: true };
    }),
    deleteAd: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.delete(ads).where(eq2(ads.id, input.id));
      return { success: true };
    }),
    paymentAccounts: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(paymentAccounts).orderBy(paymentAccounts.currency, paymentAccounts.provider);
    }),
    savePaymentAccount: protectedProcedure.input(
      z2.object({
        id: z2.number().int().positive().optional(),
        currency: z2.enum(["PKR", "USD"]),
        provider: z2.string().trim().min(2).max(64),
        accountName: z2.string().trim().min(2).max(128),
        accountDetails: z2.string().trim().min(3).max(256),
        isActive: z2.boolean()
      })
    ).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      if (input.id)
        await db.update(paymentAccounts).set(input).where(eq2(paymentAccounts.id, input.id));
      else await db.insert(paymentAccounts).values(input);
      return { success: true };
    }),
    deletePaymentAccount: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.delete(paymentAccounts).where(eq2(paymentAccounts.id, input.id));
      return { success: true };
    }),
    broadcasts: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(broadcasts).orderBy(desc2(broadcasts.createdAt));
    }),
    createBroadcast: protectedProcedure.input(
      z2.object({
        title: z2.string().trim().min(3).max(140),
        body: z2.string().trim().min(3).max(5e3),
        mediaUrl: z2.string().url().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.insert(broadcasts).values({ ...input, mediaUrl: input.mediaUrl ?? null });
      return { success: true };
    }),
    tickets: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      return db.select().from(supportTickets).orderBy(desc2(supportTickets.updatedAt));
    }),
    respondTicket: protectedProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        status: z2.enum(["open", "in_review", "resolved"]),
        response: z2.string().trim().max(5e3).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await getAdmin(ctx);
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      await db.update(supportTickets).set({
        status: input.status,
        adminResponse: input.response ?? null,
        respondedAt: input.response ? /* @__PURE__ */ new Date() : null
      }).where(eq2(supportTickets.id, input.id));
      return { success: true };
    }),
    settings: protectedProcedure.query(async ({ ctx }) => {
      await getAdmin(ctx);
      return getSettings();
    }),
    saveSettings: protectedProcedure.input(
      z2.object({
        exchangeRatePkrPerUsd: z2.number().int().min(1),
        minimumWithdrawalPkr: z2.number().int().min(1),
        maximumWithdrawalPkr: z2.number().int().min(1),
        adTimerSeconds: z2.number().int().min(5).max(600),
        referralCommissionPercent: z2.number().int().min(0).max(100),
        websiteName: z2.string().trim().min(2).max(80),
        themeName: z2.enum(["green", "blue", "dark", "white"]),
        logoData: z2.string().max(8e6).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const { user } = await getAdmin(ctx);
      if (input.maximumWithdrawalPkr < input.minimumWithdrawalPkr)
        fail("Maximum withdrawal must be greater than the minimum.");
      const db = await getDb();
      if (!db)
        fail("Database is temporarily unavailable.", "INTERNAL_SERVER_ERROR");
      const { logoData, ...settingsInput } = input;
      const logo = logoData ? await saveUpload(user.id, logoData, "brand-logos") : null;
      await db.update(appSettings).set({
        ...settingsInput,
        ...logo ? { logoUrl: logo.url, logoKey: logo.key } : {}
      }).where(eq2(appSettings.id, 1));
      return { success: true };
    })
  })
});

// server/_core/context.ts
import { parse } from "cookie";
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  if (!user) {
    const cookies = parse(opts.req.headers.cookie ?? "");
    const localUserId = await readLocalSession(cookies[LOCAL_SESSION_COOKIE]);
    user = localUserId ? await getUserById(localUserId) ?? null : null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/app.ts
function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/vercel-api.ts
var vercel_api_default = createApp();
export {
  vercel_api_default as default
};
