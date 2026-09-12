import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import {
  appSettings,
  InsertUser,
  packages,
  paymentAccounts,
  profiles,
  type Profile,
  type User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  DESIGNATED_ADMIN_EMAIL,
  DESIGNATED_ADMIN_USERNAME,
  isDesignatedAdministrator,
  isEligibleForNewUserWhatsappReward,
} from "./rules";
import { getPakistanDayKey } from "../shared/adRules";

let _db: ReturnType<typeof drizzle> | null = null;

export const ADMIN_EMAIL = DESIGNATED_ADMIN_EMAIL;
export const ADMIN_USERNAME = DESIGNATED_ADMIN_USERNAME;

const defaultPackages = [
  { tier: "pkr_100", name: "100 PKR Package", icon: "🥉", pricePkr: 100, dailyAds: 1, adRewardPkr: 30 },
  { tier: "pkr_200", name: "200 PKR Package", icon: "🥈", pricePkr: 200, dailyAds: 2, adRewardPkr: 30 },
  { tier: "pkr_300", name: "300 PKR Package", icon: "🔷", pricePkr: 300, dailyAds: 2, adRewardPkr: 40 },
  { tier: "pkr_400", name: "400 PKR Package", icon: "🔶", pricePkr: 400, dailyAds: 2, adRewardPkr: 60 },
  { tier: "pkr_500", name: "500 PKR Package", icon: "🥇", pricePkr: 500, dailyAds: 3, adRewardPkr: 70 },
  { tier: "pkr_1000", name: "1000 PKR Package", icon: "💎", pricePkr: 1000, dailyAds: 4, adRewardPkr: 80 },
  { tier: "pkr_2000", name: "2000 PKR Package", icon: "💠", pricePkr: 2000, dailyAds: 5, adRewardPkr: 100 },
  { tier: "pkr_5000", name: "5000 PKR Package", icon: "👑", pricePkr: 5000, dailyAds: 5, adRewardPkr: 200 },
] as const;

const defaultAccounts = [
  {
    currency: "PKR" as const,
    provider: "JazzCash / JazzChain",
    accountName: "Muhammad Danyal",
    accountDetails: "03269337570",
  },
  {
    currency: "PKR" as const,
    provider: "Nayapay",
    accountName: "Muhammad Danyal",
    accountDetails: "03311332670",
  },
  {
    currency: "PKR" as const,
    provider: "Opay",
    accountName: "Muhammad Danyal",
    accountDetails: "03311332670",
  },
  {
    currency: "USD" as const,
    provider: "USD payment account",
    accountName: "Configure in Admin Panel",
    accountDetails: "Add account number, code, or address in Admin Panel",
  },
];

export async function getDb() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!_db && databaseUrl) {
    if (/db\.example\.com/i.test(databaseUrl) || !/^mysql(?:\+[^:]+)?:\/\//i.test(databaseUrl)) {
      console.warn("[Database] Database not connected: DATABASE_URL is missing, fake, or not a MySQL URL.");
      return null;
    }
    try {
      const parsed = new URL(databaseUrl);
      const client = createPool({
        host: parsed.hostname,
        port: Number(parsed.port || 3306),
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ""),
        ssl: { rejectUnauthorized: true },
      });
      _db = drizzle({ client }) as unknown as ReturnType<typeof drizzle>;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = {
    openId: user.openId,
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };
  const updateSet: Record<string, unknown> = {
    lastSignedIn: values.lastSignedIn,
  };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role =
    user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user");
  updateSet.role = values.role;
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db.select().from(users).where(eq(users.openId, openId)).limit(1)
  )[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function linkOAuthUser(
  user: InsertUser & { emailVerified?: boolean }
) {
  if (!user.openId) throw new Error("OAuth openId is required");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email =
    user.email && user.emailVerified ? user.email.toLowerCase() : null;
  const existingByOpenId = (
    await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
  )[0];
  const existingByEmail = email
    ? (await db.select().from(users).where(sql`LOWER(${users.email}) = ${email.toLowerCase()}`).limit(1))[0]
    : undefined;
  const existing = existingByOpenId ?? existingByEmail;
  if (existing) {
    await db
      .update(users)
      .set({
        openId: user.openId,
        name: user.name ?? existing.name,
        email: email ?? existing.email,
        loginMethod: user.loginMethod ?? existing.loginMethod,
        lastSignedIn: new Date(),
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  await upsertUser({ ...user, email, lastSignedIn: new Date() });
  const created = (
    await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
  )[0];
  if (!created) throw new Error("OAuth account linking failed");
  return created.id;
}

export async function ensurePlatformData() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const settings = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  if (!settings[0]) await db.insert(appSettings).values({ id: 1, adTimerSeconds: 5 });
  await db
    .update(appSettings)
    .set({ adTimerSeconds: 5 })
    .where(eq(appSettings.id, 1));

  const existingPackages = await db.select().from(packages);
  const retainedPackageIds = new Set<number>();
  for (const item of defaultPackages) {
    const existing =
      existingPackages.find(row => row.tier === item.tier) ??
      existingPackages.find(row => row.pricePkr === item.pricePkr);
    if (existing) {
      retainedPackageIds.add(existing.id);
      await db
        .update(packages)
        .set({ ...item, durationDays: 30, isActive: true })
        .where(eq(packages.id, existing.id));
    } else {
      const result = await db
        .insert(packages)
        .values({ ...item, durationDays: 30, isActive: true });
      retainedPackageIds.add(Number(result[0].insertId));
    }
  }
  for (const existing of existingPackages) {
    if (!retainedPackageIds.has(existing.id))
      await db
        .update(packages)
        .set({ isActive: false })
        .where(eq(packages.id, existing.id));
  }

  const existingAccounts = await db
    .select({ id: paymentAccounts.id })
    .from(paymentAccounts)
    .limit(1);
  if (!existingAccounts[0])
    await db.insert(paymentAccounts).values(defaultAccounts);

}

export async function ensureProfile(user: User): Promise<Profile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensurePlatformData();
  const current = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  if (current[0]) return current[0];

  const isDesignated = user.email?.toLowerCase() === ADMIN_EMAIL;
  const baseUsername = isDesignated ? ADMIN_USERNAME : `member${user.id}`;
  const referralCode = `PEP${user.id.toString(36).toUpperCase()}`;
  await db.insert(profiles).values({
    userId: user.id,
    username: baseUsername,
    referralCode,
    balancePkr: 0,
    withdrawalLimitPkr: 0,
    whatsappRewardEligible: isEligibleForNewUserWhatsappReward(user.createdAt),
  });
  const created = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  if (!created[0]) throw new Error("Profile creation failed");
  return created[0];
}

export function isDesignatedAdmin(user: User, profile: Profile) {
  return isDesignatedAdministrator(user.email, profile.username);
}

export function getDayKey(date = new Date()) {
  return getPakistanDayKey(date);
}

export async function getSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensurePlatformData();
  const row = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  if (!row[0]) throw new Error("Settings unavailable");
  return row[0];
}

export async function getActivePackageForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  const rows = await db
    .select({ ownership: userPackages, plan: packages })
    .from(userPackages)
    .innerJoin(packages, eq(userPackages.packageId, packages.id))
    .where(and(eq(userPackages.userId, userId)))
    .orderBy(desc(userPackages.expiresAt));
  return (
    rows.find(row => row.ownership.expiresAt > now && row.plan.isActive) ?? null
  );
}

import { userPackages } from "../drizzle/schema";
