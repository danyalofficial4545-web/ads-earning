import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspect } from "node:util";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { TrpcContext } from "./_core/context";
import { transactions } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  ensurePlatformData: vi.fn(),
  getActivePackageForUser: vi.fn(),
  getDb: vi.fn(),
  getDayKey: vi.fn(),
  getSettings: vi.fn(),
  isDesignatedAdmin: vi.fn(),
}));

vi.mock("./db", () => ({ ADMIN_EMAIL: "muhammaddanyal4545@gmail.com", ...mocks }));

import { appRouter } from "./routers";

const adminProfile = { id: 1, userId: 7, username: "danyal955163", referralCode: "PEPADMIN", referredByUserId: null, balancePkr: 0, withdrawalLimitPkr: 0, preferredCurrency: "PKR" as const, isBlocked: false, createdAt: new Date(), updatedAt: new Date() };
const adminContext = () => ({ user: { id: 7, openId: "admin", name: "Admin", email: "muhammaddanyal4545@gmail.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} }, res: { clearCookie: vi.fn() } } as unknown as TrpcContext);

function reviewDatabase(record: any, pendingTransactionReferences: number[]) {
  const updates: Array<{ table: unknown; values: unknown; condition: unknown }> = [];
  const matchedTransactionReferences: number[] = [];
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [record] }) }) })),
    update: vi.fn((table) => ({ set: (values: unknown) => ({ where: (condition: unknown) => {
      updates.push({ table, values, condition });
      if (table === transactions) {
        const parameters = new MySqlDialect().sqlToQuery(condition as any).params;
        matchedTransactionReferences.push(...pendingTransactionReferences.filter((reference) => parameters.includes(reference)));
      }
    } }) })),
  };
  return { db, updates, matchedTransactionReferences };
}

describe("admin financial review procedures", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.ensureProfile.mockResolvedValue(adminProfile); mocks.isDesignatedAdmin.mockReturnValue(true); });

  it("scopes a rejected deposit transaction update to that deposit reference", async () => {
    const { db, updates, matchedTransactionReferences } = reviewDatabase({ id: 55, userId: 22, amountPkr: 500, status: "pending" }, [55, 56]);
    mocks.getDb.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.reviewDeposit({ id: 55, approved: false });
    const transactionUpdate = updates.find((update) => update.table === transactions);
    expect(transactionUpdate?.values).toMatchObject({ status: "rejected" });
    expect(inspect(transactionUpdate?.condition, { depth: 8 })).toContain("referenceId");
    expect(inspect(transactionUpdate?.condition, { depth: 8 })).toContain("referenceType");
    expect(matchedTransactionReferences).toEqual([55]);
  });

  it("scopes a rejected withdrawal transaction update to that withdrawal reference", async () => {
    const { db, updates, matchedTransactionReferences } = reviewDatabase({ id: 88, userId: 22, amountPkr: 500, status: "pending" }, [88, 89]);
    mocks.getDb.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.reviewWithdrawal({ id: 88, approved: false });
    const transactionUpdate = updates.find((update) => update.table === transactions);
    expect(transactionUpdate?.values).toMatchObject({ status: "rejected", direction: "neutral" });
    expect(inspect(transactionUpdate?.condition, { depth: 8 })).toContain("referenceId");
    expect(inspect(transactionUpdate?.condition, { depth: 8 })).toContain("referenceType");
    expect(matchedTransactionReferences).toEqual([88]);
  });
});
