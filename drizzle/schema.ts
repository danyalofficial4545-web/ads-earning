import {
  boolean,
  index,
  int,
  mediumtext,
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
  gameBalancePkr: int("gameBalancePkr").notNull().default(0),
  withdrawalLimitPkr: int("withdrawalLimitPkr").notNull().default(0),
  preferredCurrency: mysqlEnum("preferredCurrency", ["PKR", "USD"]).notNull().default("PKR"),
  isBlocked: boolean("isBlocked").notNull().default(false),
  whatsappJoined: boolean("whatsappJoined").notNull().default(false),
  whatsappRewardEligible: boolean("whatsappRewardEligible")
    .notNull()
    .default(false),
  whatsappBonusClaimed: boolean("whatsappBonusClaimed").notNull().default(false),
  whatsappRewardWithdrawn: boolean("whatsappRewardWithdrawn")
    .notNull()
    .default(false),
  euroBonusEligible: boolean("euroBonusEligible").notNull().default(false),
  euroBonusClaimed: boolean("euroBonusClaimed").notNull().default(false),
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
  mediaData: mediumtext("mediaData"),
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

export const gameWalletTransactions = mysqlTable("gameWalletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "bonus",
    "main_to_game",
    "game_to_main",
    "aviator_bet",
    "aviator_payout",
    "game_bet",
    "game_payout",
    "task_reward",
    "shared_bet",
    "shared_payout",
    "ludo_bet",
    "ludo_payout",
    "admin_adjustment",
  ]).notNull(),
  direction: mysqlEnum("direction", ["credit", "debit"]).notNull(),
  amountPkr: int("amountPkr").notNull(),
  note: varchar("note", { length: 256 }).notNull(),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: varchar("referenceId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("game_wallet_transactions_user_created_idx").on(table.userId, table.createdAt),
]);

export const aviatorRounds = mysqlTable("aviatorRounds", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  crashMultiplierX100: int("crashMultiplierX100").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  crashesAt: timestamp("crashesAt").notNull(),
  status: mysqlEnum("status", ["active", "crashed"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("aviator_rounds_user_status_idx").on(table.userId, table.status),
]);

export const aviatorBets = mysqlTable("aviatorBets", {
  id: int("id").autoincrement().primaryKey(),
  roundId: varchar("roundId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  stakePkr: int("stakePkr").notNull(),
  cashoutMultiplierX100: int("cashoutMultiplierX100"),
  payoutPkr: int("payoutPkr").notNull().default(0),
  status: mysqlEnum("status", ["active", "cashed_out", "lost"])
    .notNull()
    .default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
}, (table) => [
  index("aviator_bets_user_created_idx").on(table.userId, table.createdAt),
  index("aviator_bets_round_idx").on(table.roundId),
]);

export const gameRounds = mysqlTable("gameRounds", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  gameKey: mysqlEnum("gameKey", [
    "slots",
    "mining",
    "ludo",
    "wheel",
    "plinko",
    "color",
    "lucky",
  ]).notNull(),
  stakePkr: int("stakePkr").notNull(),
  selection: varchar("selection", { length: 64 }),
  privateState: mediumtext("privateState"),
  publicState: mediumtext("publicState"),
  multiplierX100: int("multiplierX100").notNull().default(0),
  payoutPkr: int("payoutPkr").notNull().default(0),
  status: mysqlEnum("status", ["active", "cashed_out", "settled", "lost"])
    .notNull()
    .default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
}, (table) => [
  index("game_rounds_user_game_created_idx").on(table.userId, table.gameKey, table.createdAt),
  index("game_rounds_user_status_idx").on(table.userId, table.status),
]);

export const gameTaskClaims = mysqlTable("gameTaskClaims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskKey: varchar("taskKey", { length: 64 }).notNull(),
  dayKey: varchar("dayKey", { length: 16 }).notNull(),
  rewardPkr: int("rewardPkr").notNull(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("game_task_claims_user_key_day_unique").on(table.userId, table.taskKey, table.dayKey),
  index("game_task_claims_user_claimed_idx").on(table.userId, table.claimedAt),
]);

export const sharedGameBets = mysqlTable("sharedGameBets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  gameKey: mysqlEnum("gameKey", ["aviator", "crash", "color", "lucky"])
    .notNull(),
  roundKey: varchar("roundKey", { length: 80 }).notNull(),
  stakePkr: int("stakePkr").notNull(),
  selection: varchar("selection", { length: 32 }),
  cashOutMultiplierX100: int("cashOutMultiplierX100"),
  payoutPkr: int("payoutPkr").notNull().default(0),
  status: mysqlEnum("status", ["active", "cashed_out", "won", "lost", "refunded"])
    .notNull()
    .default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
}, (table) => [
  uniqueIndex("shared_game_bets_user_round_slot_unique").on(table.userId, table.roundKey, table.selection),
  index("shared_game_bets_round_created_idx").on(table.roundKey, table.createdAt),
  index("shared_game_bets_user_created_idx").on(table.userId, table.createdAt),
]);

export const ludoQueues = mysqlTable("ludoQueues", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  stakePkr: int("stakePkr").notNull(),
  status: mysqlEnum("status", ["queued", "matched", "cancelled", "expired", "forfeit"])
    .notNull()
    .default("queued"),
  matchId: varchar("matchId", { length: 64 }),
  queuedAt: timestamp("queuedAt").defaultNow().notNull(),
  matchedAt: timestamp("matchedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("ludo_queues_stake_status_queued_idx").on(table.stakePkr, table.status, table.queuedAt),
  index("ludo_queues_user_status_idx").on(table.userId, table.status),
]);

export const ludoMatches = mysqlTable("ludoMatches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  stakePkr: int("stakePkr").notNull(),
  playerOneId: int("playerOneId").notNull(),
  playerTwoId: int("playerTwoId"),
  opponentType: mysqlEnum("opponentType", ["player", "bot"]).notNull(),
  status: mysqlEnum("status", ["active", "finished", "forfeit"])
    .notNull()
    .default("active"),
  currentTurnPlayerId: int("currentTurnPlayerId"),
  turnExpiresAt: timestamp("turnExpiresAt"),
  boardState: mediumtext("boardState").notNull(),
  winnerUserId: int("winnerUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  finishedAt: timestamp("finishedAt"),
}, (table) => [
  index("ludo_matches_player_one_created_idx").on(table.playerOneId, table.createdAt),
  index("ludo_matches_player_two_created_idx").on(table.playerTwoId, table.createdAt),
  index("ludo_matches_status_updated_idx").on(table.status, table.updatedAt),
]);

export const gameDailyStats = mysqlTable("gameDailyStats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  profitPkr: int("profitPkr").notNull().default(0),
  lossPkr: int("lossPkr").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("game_daily_stats_user_day_unique").on(table.userId, table.dayKey),
]);

export const gameTasks = mysqlTable("gameTasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  targetUrl: varchar("targetUrl", { length: 1024 }).notNull(),
  imageData: mediumtext("imageData"),
  rewardPkr: int("rewardPkr").notNull().default(20),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  proofData: mediumtext("proofData"),
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
  walletType: varchar("walletType", { length: 64 }).notNull().default("Other"),
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
  screenshotData: mediumtext("screenshotData"),
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
  minimumWithdrawalPkr: int("minimumWithdrawalPkr").notNull().default(0),
  maximumWithdrawalPkr: int("maximumWithdrawalPkr").notNull().default(3000),
  adTimerSeconds: int("adTimerSeconds").notNull().default(10),
  referralCommissionPercent: int("referralCommissionPercent").notNull().default(50),
  websiteName: varchar("websiteName", { length: 80 }).notNull().default("Ads Earning"),
  themeName: mysqlEnum("themeName", ["green", "blue", "dark", "white", "black", "red", "yellow"]).notNull().default("green"),
  buttonColor: varchar("buttonColor", { length: 24 }).notNull().default("amber"),
  euroBonusPkr: int("euroBonusPkr").notNull().default(100),
  euroAviatorEnabled: boolean("euroAviatorEnabled").notNull().default(true),
  euroMinimumBetPkr: int("euroMinimumBetPkr").notNull().default(16),
  euroMaximumBetPkr: int("euroMaximumBetPkr").notNull().default(20000),
  euroCrashBandWeights: varchar("euroCrashBandWeights", { length: 64 })
    .notNull()
    .default("70,10,10,10"),
  logoUrl: varchar("logoUrl", { length: 1024 }),
  logoData: mediumtext("logoData"),
  logoKey: varchar("logoKey", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
