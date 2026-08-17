import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_device_fingerprint_unique").on(table.deviceFingerprintHash),
  uniqueIndex("users_registration_ip_unique").on(table.registrationIpHash),
]);

export const profiles = mysqlTable("profiles", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("profiles_user_id_unique").on(table.userId),
  uniqueIndex("profiles_username_unique").on(table.username),
  uniqueIndex("profiles_referral_code_unique").on(table.referralCode),
]);

export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  tier: varchar("tier", { length: 24 }).notNull(),
  name: varchar("name", { length: 40 }).notNull(),
  icon: varchar("icon", { length: 12 }).notNull(),
  pricePkr: int("pricePkr").notNull(),
  dailyAds: int("dailyAds").notNull(),
  durationDays: int("durationDays").notNull().default(30),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("packages_tier_unique").on(table.tier)]);

export const userPackages = mysqlTable("userPackages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  packageId: int("packageId").notNull(),
  purchasedAt: timestamp("purchasedAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_packages_user_expiry_idx").on(table.userId, table.expiresAt),
]);

export const paymentAccounts = mysqlTable("paymentAccounts", {
  id: int("id").autoincrement().primaryKey(),
  currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
  currencyType: varchar("currencyType", { length: 32 }).notNull().default("PKR"),
  provider: varchar("provider", { length: 64 }).notNull(),
  accountType: varchar("accountType", { length: 64 }).notNull().default("Payment account"),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountDetails: varchar("accountDetails", { length: 256 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  packageTier: varchar("packageTier", { length: 24 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  contentType: mysqlEnum("contentType", ["text", "image", "video", "link", "app"]).notNull().default("text"),
  content: text("content").notNull(),
  targetUrl: varchar("targetUrl", { length: 1024 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("ads_package_active_idx").on(table.packageTier, table.isActive)]);

export const adSessions = mysqlTable("adSessions", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("ad_sessions_user_day_idx").on(table.userId, table.dayKey),
]);

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "package", "ad_reward", "withdrawal", "referral_limit", "adjustment"]).notNull(),
  direction: mysqlEnum("direction", ["credit", "debit", "neutral"]).notNull(),
  amountPkr: int("amountPkr").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "completed"]).notNull().default("completed"),
  note: varchar("note", { length: 256 }).notNull(),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("transactions_user_created_idx").on(table.userId, table.createdAt)]);

export const deposits = mysqlTable("deposits", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("deposits_user_status_idx").on(table.userId, table.status)]);

export const authChallenges = mysqlTable("authChallenges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  purpose: mysqlEnum("purpose", ["sign_in", "sign_up"]).notNull(),
  prompt: varchar("prompt", { length: 140 }).notNull(),
  answerHash: varchar("answerHash", { length: 64 }).notNull(),
  deviceFingerprintHash: varchar("deviceFingerprintHash", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("auth_challenges_device_expiry_idx").on(table.deviceFingerprintHash, table.expiresAt)]);

export const withdrawals = mysqlTable("withdrawals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
  amountPkr: int("amountPkr").notNull(),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountDetails: varchar("accountDetails", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  adminNote: varchar("adminNote", { length: 512 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("withdrawals_user_status_idx").on(table.userId, table.status)]);

export const supportTickets = mysqlTable("supportTickets", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("tickets_user_status_idx").on(table.userId, table.status)]);

export const broadcasts = mysqlTable("broadcasts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  body: text("body").notNull(),
  mediaUrl: varchar("mediaUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
  exchangeRatePkrPerUsd: int("exchangeRatePkrPerUsd").notNull().default(280),
  minimumWithdrawalPkr: int("minimumWithdrawalPkr").notNull().default(50),
  maximumWithdrawalPkr: int("maximumWithdrawalPkr").notNull().default(3000),
  adTimerSeconds: int("adTimerSeconds").notNull().default(10),
  referralCommissionPercent: int("referralCommissionPercent").notNull().default(50),
  websiteName: varchar("websiteName", { length: 80 }).notNull().default("Package Earn Pro"),
  themeName: mysqlEnum("themeName", ["green", "blue", "dark", "white"]).notNull().default("green"),
  logoUrl: varchar("logoUrl", { length: 1024 }),
  logoKey: varchar("logoKey", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
