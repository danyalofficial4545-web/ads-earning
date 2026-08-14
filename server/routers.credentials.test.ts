import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { profiles, users } from "../drizzle/schema";
import { hashPassword } from "./localAuth";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(), ensurePlatformData: vi.fn(), getActivePackageForUser: vi.fn(), getDb: vi.fn(), getDayKey: vi.fn(), getSettings: vi.fn(), isDesignatedAdmin: vi.fn(),
}));
vi.mock("./db", () => ({ ADMIN_EMAIL: "muhammaddanyal4545@gmail.com", ...mocks }));

import { appRouter } from "./routers";

const context = (user: unknown = null) => ({ user, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as unknown as TrpcContext);
const baseProfile = { id: 1, userId: 301, username: "newmember", referralCode: "PEP89", referredByUserId: null, balancePkr: 0, withdrawalLimitPkr: 0, preferredCurrency: "PKR" as const, isBlocked: false, createdAt: new Date(), updatedAt: new Date() };

function registrationDatabase(options?: { emailExists?: boolean; usernameExists?: boolean; referralExists?: boolean }) {
  const inserts: Array<{ table: unknown; values: any }> = [];
  let userSelects = 0; let profileSelects = 0;
  const createdUser = { id: 301, openId: "local-test", name: "newmember", email: "newmember@example.com", passwordHash: "hidden", loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  const db = {
    select: vi.fn(() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === users) { userSelects += 1; return userSelects === 1 && options?.emailExists ? [{ id: 99 }] : userSelects > 1 ? [createdUser] : []; }
            if (table === profiles) { profileSelects += 1; if (profileSelects === 1) return options?.usernameExists ? [{ id: 88 }] : []; return options?.referralExists ? [{ ...baseProfile, userId: 444, referralCode: "PEPREF" }] : []; }
            return [];
          },
        }),
      }),
    })),
    insert: vi.fn((table) => ({ values: async (values: any) => { inserts.push({ table, values }); return [{ insertId: table === users ? 301 : 1 }]; } })),
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
  };
  return { db, inserts };
}

describe("custom credential router", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("creates a credential account with a password hash, profile, referral link, and local session", async () => {
    const { db, inserts } = registrationDatabase({ referralExists: true });
    mocks.getDb.mockResolvedValue(db);
    const ctx = context();
    const result = await appRouter.createCaller(ctx).auth.register({ username: "newmember", email: "newmember@example.com", password: "StrongPass123", referralCode: "PEPREF" });
    expect(result.user).toMatchObject({ id: 301, email: "newmember@example.com" });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(inserts.find((row) => row.table === users)?.values.passwordHash).not.toContain("StrongPass123");
    expect(inserts.find((row) => row.table === profiles)?.values).toMatchObject({ username: "newmember", referredByUserId: 444 });
    expect((ctx.res.cookie as any)).toHaveBeenCalledOnce();
  });

  it("rejects duplicate email, duplicate username, reserved administrator identity, and invalid referrals", async () => {
    let testDb = registrationDatabase({ emailExists: true }); mocks.getDb.mockResolvedValue(testDb.db);
    await expect(appRouter.createCaller(context()).auth.register({ username: "newmember", email: "newmember@example.com", password: "StrongPass123" })).rejects.toMatchObject({ code: "CONFLICT" });
    testDb = registrationDatabase({ usernameExists: true }); mocks.getDb.mockResolvedValue(testDb.db);
    await expect(appRouter.createCaller(context()).auth.register({ username: "newmember", email: "other@example.com", password: "StrongPass123" })).rejects.toMatchObject({ code: "CONFLICT" });
    mocks.getDb.mockResolvedValue(registrationDatabase().db);
    await expect(appRouter.createCaller(context()).auth.register({ username: "danyal955163", email: "other@example.com", password: "StrongPass123" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    testDb = registrationDatabase(); mocks.getDb.mockResolvedValue(testDb.db);
    await expect(appRouter.createCaller(context()).auth.register({ username: "newmember", email: "referral@example.com", password: "StrongPass123", referralCode: "MISSING" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows only the correct password to create a local sign-in session", async () => {
    const passwordHash = await hashPassword("StrongPass123");
    const user = { id: 301, openId: "local-test", name: "newmember", email: "newmember@example.com", passwordHash, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [user] }) }) })),
      update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
    };
    mocks.getDb.mockResolvedValue(db); mocks.ensureProfile.mockResolvedValue(baseProfile);
    const ctx = context();
    await expect(appRouter.createCaller(ctx).auth.signIn({ email: "newmember@example.com", password: "WrongPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const success = await appRouter.createCaller(ctx).auth.signIn({ email: "newmember@example.com", password: "StrongPass123" });
    expect(success.user).toMatchObject({ id: 301, email: "newmember@example.com" });
    expect((ctx.res.cookie as any)).toHaveBeenCalledOnce();
  });

  it("lets an authenticated Google-style account set a hashed password for later email sign-in", async () => {
    const updates: any[] = [];
    const db = { update: vi.fn(() => ({ set: (values: any) => { updates.push(values); return { where: async () => undefined }; } })) };
    mocks.getDb.mockResolvedValue(db);
    const googleUser = { id: 301, openId: "google-open-id", name: "Danyal", email: "muhammaddanyal4545@gmail.com", passwordHash: null, loginMethod: "google", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const ctx = context(googleUser);
    const result = await appRouter.createCaller(ctx).auth.setPassword({ password: "StrongPass123" });
    expect(result).toEqual({ success: true });
    expect(updates[0].passwordHash).not.toContain("StrongPass123");
    expect(updates[0]).toMatchObject({ loginMethod: "password" });
    expect((ctx.res.cookie as any)).toHaveBeenCalledOnce();
  });
});
