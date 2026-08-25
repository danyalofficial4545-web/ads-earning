import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";
import { adSessions } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  getActivePackageForUser: vi.fn(),
  getDb: vi.fn(),
  getDayKey: vi.fn(),
  getSettings: vi.fn(),
  isDesignatedAdmin: vi.fn(),
}));

vi.mock("./db", () => ({
  ADMIN_EMAIL: "muhammaddanyal4545@gmail.com",
  ...mocks,
}));

import { appRouter } from "./routers";

const member = {
  id: 91,
  openId: "ads-member",
  name: "Ads Member",
  email: "ads@example.com",
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
const profile = {
  id: 9,
  userId: 91,
  username: "adsmember",
  referralCode: "PEP91",
  referredByUserId: null,
  balancePkr: 0,
  withdrawalLimitPkr: 0,
  preferredCurrency: "PKR" as const,
  isBlocked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const callerContext = () =>
  ({
    user: member,
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  }) as unknown as TrpcContext;

function createAdsDatabase() {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const db = {
    select: vi.fn(() => ({
      from: (table: unknown) =>
        table === adSessions
          ? { where: async () => [] }
          : { where: async () => [] },
    })),
    insert: vi.fn((table: unknown) => ({
      values: async (values: unknown) => {
        inserts.push({ table, values });
        return [{ insertId: 700 }];
      },
    })),
  };
  return { db, inserts };
}

describe("rewarded slot start access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ensureProfile.mockResolvedValue(profile);
    mocks.getDayKey.mockReturnValue("2026-08-15");
    mocks.getSettings.mockResolvedValue({ adTimerSeconds: 10 });
    mocks.getActivePackageForUser.mockResolvedValue({
      plan: { pricePkr: 200, name: "Silver" },
      ownership: { id: 55 },
    });
  });

  it("starts the next sequential rewarded slot within the two-ad Silver quota", async () => {
    const { db, inserts } = createAdsDatabase();
    mocks.getDb.mockResolvedValue(db);

    await appRouter.createCaller(callerContext()).earning.startAd({ slot: 1 });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.table).toBe(adSessions);
    expect(inserts[0]?.values).toMatchObject({
      userId: 91,
      userPackageId: 55,
      adId: 1,
      dayKey: "2026-08-15",
    });
  });

  it("rejects a rewarded slot beyond the package daily quota", async () => {
    const { db, inserts } = createAdsDatabase();
    mocks.getDb.mockResolvedValue(db);

    await expect(
      appRouter.createCaller(callerContext()).earning.startAd({ slot: 3 })
    ).rejects.toThrow("locked");
    expect(inserts).toHaveLength(0);
  });
});
