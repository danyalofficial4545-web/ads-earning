import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { authChallenges, profiles, users } from "../drizzle/schema";
import { hashPassword } from "./localAuth";
import { hashSecurityValue } from "./security";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(), ensurePlatformData: vi.fn(), getActivePackageForUser: vi.fn(), getDb: vi.fn(), getDayKey: vi.fn(), getSettings: vi.fn(), isDesignatedAdmin: vi.fn(),
}));
vi.mock("./db", () => ({ ADMIN_EMAIL: "muhammaddanyal4545@gmail.com", ...mocks }));

import { appRouter } from "./routers";

const context = (user: unknown = null) => ({ user, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as unknown as TrpcContext);
const baseProfile = { id: 1, userId: 301, username: "newmember", referralCode: "PEP89", referredByUserId: null, balancePkr: 0, withdrawalLimitPkr: 0, preferredCurrency: "PKR" as const, isBlocked: false, createdAt: new Date(), updatedAt: new Date() };
const challengeInput = { challengeId: "11111111-1111-4111-8111-111111111111", challengeAnswer: "A7K2M", deviceId: "device-marker-for-credential-router-tests" };
const challengeRow = { id: challengeInput.challengeId, purpose: "sign_up" as const, prompt: "Enter the characters shown in the verification image.", answerHash: hashSecurityValue("A7K2M"), deviceFingerprintHash: hashSecurityValue(challengeInput.deviceId), expiresAt: new Date(Date.now() + 60_000), consumedAt: null, createdAt: new Date() };

function registrationDatabase(options?: { emailExists?: boolean; usernameExists?: boolean; referralExists?: boolean; deviceExists?: boolean; networkExists?: boolean }) {
  const inserts: Array<{ table: unknown; values: any }> = [];
  let userSelects = 0; let profileSelects = 0;
  const createdUser = { id: 301, openId: "local-test", name: "newmember", email: "newmember@example.com", passwordHash: "hidden", loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  const db = {
    select: vi.fn(() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === authChallenges) return [challengeRow];
            if (table === users) { userSelects += 1; if (userSelects === 1) return options?.emailExists ? [{ id: 99 }] : []; if (userSelects === 2) return options?.deviceExists ? [{ id: 98 }] : []; if (userSelects === 3) return options?.networkExists ? [{ id: 97 }] : []; return [createdUser]; }
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

  it("creates a manual Gmail account only after the visual verification code is correct", async () => {
    const { db, inserts } = registrationDatabase();
    mocks.getDb.mockResolvedValue(db);
    const ctx = context();
    const result = await appRouter.createCaller(ctx).auth.register({ username: "newmember", email: "newmember@example.com", password: "StrongPass123", ...challengeInput });
    expect(result.user).toMatchObject({ id: 301, email: "newmember@example.com" });
    expect(inserts.map(entry => entry.table)).toEqual([users, profiles]);
    expect((ctx.res.cookie as any)).toHaveBeenCalledOnce();
  });

  it("allows only the correct password to create a local sign-in session", async () => {
    const passwordHash = await hashPassword("StrongPass123");
    const user = { id: 301, openId: "local-test", name: "newmember", email: "newmember@example.com", passwordHash, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const db = {
      select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => table === authChallenges ? [{ ...challengeRow, purpose: "sign_in" as const }] : [user] }) }) })),
      update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
    };
    mocks.getDb.mockResolvedValue(db); mocks.ensureProfile.mockResolvedValue(baseProfile);
    const ctx = context();
    await expect(appRouter.createCaller(ctx).auth.signIn({ email: "newmember@example.com", password: "WrongPass123", ...challengeInput })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const success = await appRouter.createCaller(ctx).auth.signIn({ email: "newmember@example.com", password: "StrongPass123", ...challengeInput });
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
