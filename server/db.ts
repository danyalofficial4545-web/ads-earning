import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  ads,
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
} from "./rules";
import { getPakistanDayKey } from "../shared/adRules";

let _db: ReturnType<typeof drizzle> | null = null;

export const ADMIN_EMAIL = DESIGNATED_ADMIN_EMAIL;
export const ADMIN_USERNAME = DESIGNATED_ADMIN_USERNAME;

const defaultPackages = [
  { tier: "bronze", name: "Bronze", icon: "🥉", pricePkr: 100, dailyAds: 1 },
  { tier: "silver", name: "Silver", icon: "🥈", pricePkr: 200, dailyAds: 2 },
  { tier: "gold", name: "Gold", icon: "🥇", pricePkr: 500, dailyAds: 5 },
  {
    tier: "platinum",
    name: "Platinum",
    icon: "💎",
    pricePkr: 1000,
    dailyAds: 10,
  },
  {
    tier: "diamond",
    name: "Diamond",
    icon: "💠",
    pricePkr: 2000,
    dailyAds: 20,
  },
  { tier: "vip", name: "VIP", icon: "👑", pricePkr: 5000, dailyAds: 50 },
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
    provider: "PayPal",
    accountName: "Administrator",
    accountDetails: "Configure in Admin Panel",
  },
];

export async function getDb() {
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
    ? (await db.select().from(users).where(eq(users.email, email)).limit(1))[0]
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
  if (!settings[0]) await db.insert(appSettings).values({ id: 1 });

  for (const item of defaultPackages) {
    const existing = await db
      .select({ id: packages.id })
      .from(packages)
      .where(eq(packages.tier, item.tier))
      .limit(1);
    if (!existing[0])
      await db
        .insert(packages)
        .values({ ...item, durationDays: 30, isActive: true });
  }

  const existingAccounts = await db
    .select({ id: paymentAccounts.id })
    .from(paymentAccounts)
    .limit(1);
  if (!existingAccounts[0])
    await db.insert(paymentAccounts).values(defaultAccounts);

  for (const item of defaultPackages) {
    const existing = await db
      .select({ id: ads.id })
      .from(ads)
      .where(and(eq(ads.packageTier, item.tier), eq(ads.isActive, true)))
      .limit(1);
    if (!existing[0]) {
      await db.insert(ads).values({
        packageTier: item.tier,
        title: `${item.name} daily opportunity`,
        contentType: "text",
        content:
          "Read this sponsored opportunity until the reward timer completes.",
        isActive: true,
      });
    }
  }
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
