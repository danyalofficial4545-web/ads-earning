import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspect } from "node:util";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { TrpcContext } from "./_core/context";
import { deposits, packages, profiles, transactions, userPackages, users, withdrawals } from "../drizzle/schema";

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

function reviewDatabase(record: any, pendingTransactionReferences: number[], profileRecord: any = record) {
  const updates: Array<{ table: unknown; values: unknown; condition: unknown }> = [];
  const matchedTransactionReferences: number[] = [];
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => [table === profiles ? profileRecord : record] }) }) })),
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

  it("credits an approved deposit to the member wallet and marks only its history transaction approved", async () => {
    const { db, updates, matchedTransactionReferences } = reviewDatabase(
      { id: 57, userId: 22, amountPkr: 500, status: "pending" },
      [57, 58],
      { userId: 22, balancePkr: 400, withdrawalLimitPkr: 0 }
    );
    mocks.getDb.mockResolvedValue(db);

    await appRouter.createCaller(adminContext()).admin.reviewDeposit({ id: 57, approved: true });

    const profileUpdate = updates.find(update => update.table === profiles);
    expect(profileUpdate?.values).toEqual({ balancePkr: 900 });
    const transactionUpdate = updates.find(update => update.table === transactions);
    expect(transactionUpdate?.values).toMatchObject({ status: "approved" });
    expect(matchedTransactionReferences).toEqual([57]);
  });

  it("refunds a rejected withdrawal and restores its reserved limit", async () => {
    const { db, updates, matchedTransactionReferences } = reviewDatabase({ id: 88, userId: 22, amountPkr: 500, status: "pending" }, [88, 89], { userId: 22, balancePkr: 700, withdrawalLimitPkr: 0 });
    mocks.getDb.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.reviewWithdrawal({ id: 88, approved: false });
    const profileUpdate = updates.find((update) => update.table === profiles);
    expect(profileUpdate?.values).toEqual({ balancePkr: 1200, withdrawalLimitPkr: 500 });
    const transactionUpdate = updates.find((update) => update.table === transactions);
    expect(transactionUpdate?.values).toMatchObject({ status: "rejected", direction: "neutral" });
    expect(inspect(transactionUpdate?.condition, { depth: 8 })).toContain("referenceId");
    expect(inspect(transactionUpdate?.condition, { depth: 8 })).toContain("referenceType");
    expect(matchedTransactionReferences).toEqual([88]);
  });

  it("approves a pending withdrawal without refunding the wallet or wiping new referral credits", async () => {
    const { db, updates } = reviewDatabase({ id: 89, userId: 22, amountPkr: 500, status: "pending" }, [89], { userId: 22, balancePkr: 700, withdrawalLimitPkr: 300 });
    mocks.getDb.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.reviewWithdrawal({ id: 89, approved: true });
    expect(updates.some((update) => update.table === profiles)).toBe(false);
    const transactionUpdate = updates.find((update) => update.table === transactions);
    expect(transactionUpdate?.values).toMatchObject({ status: "approved", direction: "debit" });
  });

  it("returns enriched protected deposit and withdrawal request details for administrator review", async () => {
    const depositRows = [{ id: 11, userId: 22, amountPkr: 500, method: "Easypaisa", senderAccountName: "Ali", senderAccountNumber: "03001234567", transactionId: "TID-500", requestedPackageId: 4, createdAt: new Date() }];
    const withdrawalRows = [{ id: 12, userId: 22, amountPkr: 300, currency: "PKR", accountName: "Ali", accountDetails: "03001234567", createdAt: new Date() }];
    const memberRows = [{ userId: 22, email: "ali@example.com", username: "ali", balancePkr: 900, withdrawalLimitPkr: 300 }];
    const packageRows = [{ id: 4, name: "Platinum" }];
    const referralRows = [{ referredByUserId: 22 }, { referredByUserId: 22 }];
    const activePackageRows = [{ userId: 22, packageName: "Platinum" }];
    const db = {
      select: vi.fn(() => {
        let table: unknown;
        const result = () => table === deposits ? depositRows : table === withdrawals ? withdrawalRows : table === users ? memberRows : table === packages ? packageRows : table === profiles ? referralRows : table === userPackages ? activePackageRows : [];
        const query: any = {
          from: (source: unknown) => { table = source; return query; },
          orderBy: async () => result(),
          innerJoin: () => table === users ? Promise.resolve(result()) : query,
          where: async () => result(),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
        };
        return query;
      }),
    };
    mocks.getDb.mockResolvedValue(db);
    const result = await appRouter.createCaller(adminContext()).admin.financialRequests();
    expect(result.deposits[0]).toMatchObject({ senderAccountName: "Ali", senderAccountNumber: "03001234567", transactionId: "TID-500", requestedPackageName: "Platinum", member: { username: "ali", balancePkr: 900, activePackageName: "Platinum" } });
    expect(result.withdrawals[0]).toMatchObject({ member: { username: "ali", withdrawalLimitPkr: 300, referralCount: 2, activePackageName: "Platinum" } });
  });

  it("allows an administrator to delete only reviewed financial history records", async () => {
    const deleted: unknown[] = [];
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 71, userId: 22, status: "approved" }] }) }) })),
      delete: vi.fn((table) => ({ where: async (condition: unknown) => deleted.push({ table, condition }) })),
    };
    mocks.getDb.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.deleteDepositHistory({ id: 71 });
    await appRouter.createCaller(adminContext()).admin.deleteWithdrawalHistory({ id: 71 });
    expect(deleted.map((item: any) => item.table)).toEqual([deposits, withdrawals]);
  });
});
