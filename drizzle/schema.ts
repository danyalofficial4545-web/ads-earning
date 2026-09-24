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

export const users = mysqlTable(
  "users",
  {
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
  },
  table => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_device_fingerprint_unique").on(
      table.deviceFingerprintHash
    ),
    uniqueIndex("users_registration_ip_unique").on(table.registrationIpHash),
  ]
);

export const profiles = mysqlTable(
  "profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    username: varchar("username", { length: 32 }).notNull(),
    referralCode: varchar("referralCode", { length: 32 }).notNull(),
    referredByUserId: int("referredByUserId"),
    balancePkr: int("balancePkr").notNull().default(0),
    depositWalletBalance: int("deposit_wallet_balance").notNull().default(0),
    earningWalletBalance: int("earning_wallet_balance").notNull().default(0),
    withdrawalLimitPkr: int("withdrawalLimitPkr").notNull().default(0),
    activePackageId: int("active_package_id"),
    packageExpiryDate: timestamp("package_expiry_date"),
    preferredCurrency: mysqlEnum("preferredCurrency", ["PKR", "USD"])
      .notNull()
      .default("PKR"),
    isBlocked: boolean("isBlocked").notNull().default(false),
    whatsappJoined: boolean("whatsappJoined").notNull().default(false),
    whatsappRewardEligible: boolean("whatsappRewardEligible")
      .notNull()
      .default(false),
    whatsappBonusClaimed: boolean("whatsappBonusClaimed")
      .notNull()
      .default(false),
    whatsappRewardWithdrawn: boolean("whatsappRewardWithdrawn")
      .notNull()
      .default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    uniqueIndex("profiles_username_unique").on(table.username),
    uniqueIndex("profiles_referral_code_unique").on(table.referralCode),
  ]
);

export const packages = mysqlTable(
  "packages",
  {
    id: int("id").autoincrement().primaryKey(),
    tier: varchar("tier", { length: 24 }).notNull(),
    name: varchar("name", { length: 40 }).notNull(),
    icon: varchar("icon", { length: 12 }).notNull(),
    pricePkr: int("pricePkr").notNull(),
    priceCoins: int("priceCoins").notNull().default(0),
    dailyAds: int("dailyAds").notNull(),
    adRewardPkr: int("adRewardPkr").notNull().default(20),
    dailyTasks: int("dailyTasks").notNull().default(1),
    dailyEarningCoins: int("dailyEarningCoins").notNull().default(0),
    minWithdrawCoins: int("minWithdrawCoins").notNull().default(0),
    durationDays: int("durationDays").notNull().default(30),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("packages_tier_unique").on(table.tier)]
);

export const userPackages = mysqlTable(
  "userPackages",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    packageId: int("packageId").notNull(),
    purchasedAt: timestamp("purchasedAt").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("user_packages_user_expiry_idx").on(table.userId, table.expiresAt),
  ]
);

export const paymentAccounts = mysqlTable("paymentAccounts", {
  id: int("id").autoincrement().primaryKey(),
  currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
  currencyType: varchar("currencyType", { length: 32 })
    .notNull()
    .default("PKR"),
  provider: varchar("provider", { length: 64 }).notNull(),
  accountType: varchar("accountType", { length: 64 })
    .notNull()
    .default("Payment account"),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountDetails: varchar("accountDetails", { length: 256 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ads = mysqlTable(
  "ads",
  {
    id: int("id").autoincrement().primaryKey(),
    packageTier: varchar("packageTier", { length: 24 }).notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    contentType: mysqlEnum("contentType", [
      "text",
      "image",
      "video",
      "link",
      "app",
    ])
      .notNull()
      .default("text"),
    content: text("content").notNull(),
    mediaData: mediumtext("mediaData"),
    targetUrl: varchar("targetUrl", { length: 1024 }),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ads_package_active_idx").on(table.packageTier, table.isActive),
  ]
);

export const adSessions = mysqlTable(
  "adSessions",
  {
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
  },
  table => [index("ad_sessions_user_day_idx").on(table.userId, table.dayKey)]
);

export const adminAdImpressions = mysqlTable(
  "adminAdImpressions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    dayKey: varchar("dayKey", { length: 10 }).notNull(),
    placement: varchar("placement", { length: 32 }).notNull(),
    sequence: int("sequence").notNull().default(0),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("admin_ad_impressions_day_idx").on(table.dayKey, table.completedAt),
    uniqueIndex("admin_ad_impressions_user_slot_unique").on(
      table.userId,
      table.dayKey,
      table.placement,
      table.sequence
    ),
  ]
);

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    direction: mysqlEnum("direction", ["credit", "debit", "neutral"]).notNull(),
    amountPkr: int("amountPkr").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "approved",
      "rejected",
      "completed",
    ])
      .notNull()
      .default("completed"),
    note: varchar("note", { length: 256 }).notNull(),
    referenceType: varchar("referenceType", { length: 50 }),
    referenceId: varchar("referenceId", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("transactions_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const deposits = mysqlTable(
  "deposits",
  {
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
    status: mysqlEnum("status", ["pending", "approved", "rejected"])
      .notNull()
      .default("pending"),
    adminNote: varchar("adminNote", { length: 512 }),
    rejectionReason: varchar("rejectionReason", { length: 512 }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("deposits_user_status_idx").on(table.userId, table.status)]
);

export const referralRewards = mysqlTable("referralRewards", {
  id: int("id").autoincrement().primaryKey(),
  depositId: int("depositId").notNull().unique(),
  inviterId: int("inviterId").notNull(),
  invitedUserId: int("invitedUserId").notNull(),
  amountPkr: int("amountPkr").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const referrals = mysqlTable(
  "referrals",
  {
    id: int("id").autoincrement().primaryKey(),
    referrerId: int("referrerId").notNull(),
    referredId: int("referredId").notNull().unique(),
    totalTasksRewarded: int("totalTasksRewarded").notNull().default(0),
    maxTaskReward: int("maxTaskReward").notNull().default(50),
    totalTaskEarnings: int("totalTaskEarnings").notNull().default(0),
    totalWithdrawCommission: int("totalWithdrawCommission")
      .notNull()
      .default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("referrals_referrer_idx").on(table.referrerId)]
);

export const referralTaskRewards = mysqlTable(
  "referralTaskRewards",
  {
    id: int("id").autoincrement().primaryKey(),
    referrerId: int("referrerId").notNull(),
    referredId: int("referredId").notNull(),
    taskId: int("taskId"),
    rewardCoins: int("rewardCoins").notNull().default(100),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("referral_task_rewards_referrer_idx").on(
      table.referrerId,
      table.createdAt
    ),
    uniqueIndex("referral_task_rewards_task_unique").on(
      table.referredId,
      table.taskId
    ),
  ]
);

export const timewallPostbacks = mysqlTable(
  "timewall_postbacks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    coinsReceived: int("coinsReceived").notNull(),
    coinsGivenToUser: int("coinsGivenToUser").notNull(),
    transactionId: varchar("transactionId", { length: 160 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("timewall_postbacks_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
);

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    imageUrl: mediumtext("imageUrl"),
    mediaType: varchar("mediaType", { length: 32 }).notNull().default("image"),
    description: text("description").notNull(),
    rewardCoins: int("rewardCoins").notNull(),
    hiddenProfit: int("hiddenProfit").notNull().default(0),
    playstoreLink: varchar("playstoreLink", { length: 1024 }).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tasks_active_created_idx").on(table.isActive, table.createdAt),
  ]
);

export const taskProofs = mysqlTable(
  "task_proofs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    taskId: int("taskId").notNull(),
    gameUserId: varchar("gameUserId", { length: 160 }).notNull(),
    screenshotUrl: mediumtext("screenshotUrl").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"])
      .notNull()
      .default("pending"),
    rejectReason: text("rejectReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  table => [
    index("task_proofs_user_created_idx").on(table.userId, table.createdAt),
    index("task_proofs_status_created_idx").on(table.status, table.createdAt),
  ]
);

export const authChallenges = mysqlTable(
  "authChallenges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    purpose: mysqlEnum("purpose", ["sign_in", "sign_up"]).notNull(),
    prompt: varchar("prompt", { length: 140 }).notNull(),
    answerHash: varchar("answerHash", { length: 64 }).notNull(),
    deviceFingerprintHash: varchar("deviceFingerprintHash", {
      length: 64,
    }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("auth_challenges_device_expiry_idx").on(
      table.deviceFingerprintHash,
      table.expiresAt
    ),
  ]
);

export const withdrawals = mysqlTable(
  "withdrawals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    currency: mysqlEnum("currency", ["PKR", "USD"]).notNull(),
    amountPkr: int("amountPkr").notNull(),
    walletType: varchar("walletType", { length: 64 })
      .notNull()
      .default("Other"),
    accountName: varchar("accountName", { length: 128 }).notNull(),
    accountDetails: varchar("accountDetails", { length: 512 }).notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"])
      .notNull()
      .default("pending"),
    adminNote: varchar("adminNote", { length: 512 }),
    rejectionReason: varchar("rejectionReason", { length: 512 }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("withdrawals_user_status_idx").on(table.userId, table.status)]
);

export const supportTickets = mysqlTable(
  "supportTickets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    subject: varchar("subject", { length: 140 }).notNull(),
    description: text("description").notNull(),
    screenshotUrl: varchar("screenshotUrl", { length: 1024 }),
    screenshotKey: varchar("screenshotKey", { length: 512 }),
    screenshotData: mediumtext("screenshotData"),
    status: mysqlEnum("status", ["open", "in_review", "resolved"])
      .notNull()
      .default("open"),
    adminResponse: text("adminResponse"),
    respondedAt: timestamp("respondedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("tickets_user_status_idx").on(table.userId, table.status)]
);

export const supportChatMessages = mysqlTable(
  "supportChatMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["user", "assistant", "admin"]).notNull(),
    content: text("content").notNull(),
    aiGenerated: boolean("aiGenerated").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("support_chat_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const broadcasts = mysqlTable("broadcasts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  body: text("body").notNull(),
  mediaUrl: varchar("mediaUrl", { length: 1024 }),
  type: mysqlEnum("type", ["info", "warning"]).notNull().default("info"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const supportReplyRules = mysqlTable("supportReplyRules", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 120 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 140 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("isRead").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("notifications_user_read_idx").on(
      table.userId,
      table.isRead,
      table.createdAt
    ),
  ]
);

export const appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
  exchangeRatePkrPerUsd: int("exchangeRatePkrPerUsd").notNull().default(280),
  minimumWithdrawalPkr: int("minimumWithdrawalPkr").notNull().default(0),
  maximumWithdrawalPkr: int("maximumWithdrawalPkr").notNull().default(3000),
  adTimerSeconds: int("adTimerSeconds").notNull().default(5),
  automaticAdsEnabled: boolean("automaticAdsEnabled").notNull().default(true),
  referralCommissionPercent: int("referralCommissionPercent")
    .notNull()
    .default(50),
  websiteName: varchar("websiteName", { length: 80 })
    .notNull()
    .default("Ads Earning"),
  themeName: mysqlEnum("themeName", [
    "green",
    "blue",
    "dark",
    "white",
    "black",
    "red",
    "yellow",
  ])
    .notNull()
    .default("green"),
  buttonColor: varchar("buttonColor", { length: 24 })
    .notNull()
    .default("amber"),
  logoUrl: varchar("logoUrl", { length: 1024 }),
  logoData: mediumtext("logoData"),
  logoKey: varchar("logoKey", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
