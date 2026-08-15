import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { packages, profiles } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  getActivePackageForUser: vi.fn(),
  getDb: vi.fn(),
  getSettings: vi.fn(),
  isDesignatedAdmin: vi.fn(),
}));

vi.mock("./db", () => ({ ADMIN_EMAIL: "muhammaddanyal4545@gmail.com", ...mocks }));

import { appRouter } from "./routers";

const member = { id: 20, openId: "member", name: "Member", email: "member@example.com", loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const memberProfile = { id: 2, userId: 20, username: "member", referralCode: "PEP14", referredByUserId: 10, balancePkr: 1000, withdrawalLimitPkr: 0, preferredCurrency: "PKR" as const, isBlocked: false, createdAt: new Date(), updatedAt: new Date() };
const referrerProfile = { id: 1, userId: 10, username: "referrer", referralCode: "PEP10", referredByUserId: null, balancePkr: 777, withdrawalLimitPkr: 0, preferredCurrency: "PKR" as const, isBlocked: false, createdAt: new Date(), updatedAt: new Date() };

const context = () => ({ user: member, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as unknown as TrpcContext);

describe("router accounting flows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ensureProfile.mockResolvedValue(memberProfile);
    mocks.getSettings.mockResolvedValue({ referralCommissionPercent: 50, exchangeRatePkrPerUsd: 280, minimumWithdrawalPkr: 50, maximumWithdrawalPkr: 3000 });
  });

  it("deducts wallet balance immediately and reserves the one-time withdrawal limit", async () => {
    mocks.ensureProfile.mockResolvedValue({ ...memberProfile, balancePkr: 1000, withdrawalLimitPkr: 500 });
    mocks.getActivePackageForUser.mockResolvedValue({ id: 1 });
    const updates: Array<{ table: unknown; values: any }> = [];
    const inserts: Array<{ table: unknown; values: any }> = [];
    const db = {
      update: vi.fn((table) => ({ set: (values: any) => ({ where: () => { updates.push({ table, values }); } }) })),
      insert: vi.fn((table) => ({ values: async (values: any) => { inserts.push({ table, values }); return [{ insertId: 44 }]; } })),
    };
    mocks.getDb.mockResolvedValue(db);

    await appRouter.createCaller(context()).withdrawal.create({ currency: "PKR", amount: 500, accountName: "Test Account", accountDetails: "0123456789" });

    expect(updates[0]?.values).toEqual({ balancePkr: 500, withdrawalLimitPkr: 0 });
    expect(inserts[1]?.values).toMatchObject({ direction: "debit", status: "pending", amountPkr: 500, referenceId: 44 });
  });

  it("credits referral commission only to the referrer withdrawal limit", async () => {
    const plan = { id: 1, tier: "bronze", name: "Bronze", icon: "B", pricePkr: 1000, dailyAds: 2, durationDays: 30, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const updates: Array<{ table: unknown; values: any }> = [];
    const inserts: Array<{ table: unknown; values: any }> = [];
    const db = {
      select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => [table === packages ? plan : referrerProfile] }) }) })),
      update: vi.fn((table) => ({ set: (values: any) => ({ where: () => { updates.push({ table, values }); } }) })),
      insert: vi.fn((table) => ({ values: async (values: any) => { inserts.push({ table, values }); return [{ insertId: 1 }]; } })),
    };
    mocks.getDb.mockResolvedValue(db);

    await appRouter.createCaller(context()).package.buy({ packageId: 1 });

    const referrerUpdate = updates.find((entry) => entry.table === profiles && entry.values?.withdrawalLimitPkr !== undefined);
    expect(referrerUpdate?.values).toEqual({ withdrawalLimitPkr: 500 });
    expect(referrerUpdate?.values.balancePkr).toBeUndefined();
    expect(inserts.some((entry) => entry.values?.userId === 10 && entry.values?.type === "referral_limit")).toBe(true);
  });
});
