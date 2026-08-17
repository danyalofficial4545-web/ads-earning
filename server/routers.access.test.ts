import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  ensurePlatformData: vi.fn(),
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

function context() {
  return {
    user: {
      id: 42,
      openId: "ordinary-member",
      name: "Ordinary Member",
      email: "ordinary@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn() },
  } as unknown as TrpcContext;
}

const regularProfile = {
  id: 9,
  userId: 42,
  username: "ordinary_member",
  referralCode: "PEP42",
  referredByUserId: null,
  balancePkr: 0,
  withdrawalLimitPkr: 0,
  preferredCurrency: "PKR" as const,
  isBlocked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("protected Package Earn Pro router access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ensureProfile.mockResolvedValue(regularProfile);
    mocks.isDesignatedAdmin.mockReturnValue(false);
  });

  it("rejects a signed-in non-admin account from an administrator procedure", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-admin account from protected member detail records", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.admin.userDetail({ userId: 301 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects a blocked account before it can access a protected member procedure", async () => {
    mocks.ensureProfile.mockResolvedValue({ ...regularProfile, isBlocked: true });
    const caller = appRouter.createCaller(context());
    await expect(caller.platform.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
