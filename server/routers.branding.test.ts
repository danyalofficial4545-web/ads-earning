import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(), ensurePlatformData: vi.fn(), getActivePackageForUser: vi.fn(), getDb: vi.fn(), getDayKey: vi.fn(), getSettings: vi.fn(), isDesignatedAdmin: vi.fn(),
}));
vi.mock("./db", () => ({ ADMIN_EMAIL: "muhammaddanyal4545@gmail.com", ...mocks }));

import { appRouter } from "./routers";

const settings = { exchangeRatePkrPerUsd: 280, minimumWithdrawalPkr: 50, maximumWithdrawalPkr: 3000, adTimerSeconds: 10, referralCommissionPercent: 50, websiteName: "Trusted Package Earn", themeName: "blue" as const, logoUrl: "https://storage.example/brand.png", logoKey: "brand.png", logoData: null };
const context = (admin = false) => ({ user: admin ? { id: 1, openId: "admin", name: "Admin", email: "muhammaddanyal4545@gmail.com", loginMethod: "password", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as unknown as TrpcContext);

describe("administrator branding settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ensureProfile.mockResolvedValue({ id: 1, userId: 1, username: "admin", isBlocked: false });
    mocks.isDesignatedAdmin.mockReturnValue(true);
    mocks.getSettings.mockResolvedValue(settings);
  });

  it("persists text settings without a storage upload and exposes saved branding to the public platform payload", async () => {
    const updates: any[] = [];
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: async () => [] }) })),
      update: vi.fn(() => ({ set: (values: any) => { updates.push(values); return { where: async () => undefined }; } })),
    };
    mocks.getDb.mockResolvedValue(db);
    const publicPayload = await appRouter.createCaller(context()).platform.publicData();
    expect(publicPayload.branding).toEqual({ websiteName: settings.websiteName, themeName: "blue", logoUrl: settings.logoUrl });
    expect(publicPayload).not.toHaveProperty("settings");
    await appRouter.createCaller(context(true)).admin.saveSettings(settings);
    expect(updates[0]).toMatchObject({ websiteName: settings.websiteName, themeName: "blue" });
    expect(updates[0]).not.toHaveProperty("logoData");
  });

  it("stores a compact base64 brand image directly in settings without Forge storage", async () => {
    const updates: any[] = [];
    const db = {
      update: vi.fn(() => ({ set: (values: any) => { updates.push(values); return { where: async () => undefined }; } })),
    };
    mocks.getDb.mockResolvedValue(db);
    const dataUrl = "data:image/png;base64,aGVsbG8=";
    const result = await appRouter.createCaller(context(true)).admin.saveBrandLogo({ logoData: dataUrl });
    expect(result).toEqual({ success: true, logoUrl: dataUrl });
    expect(updates[0]).toEqual({ logoData: dataUrl, logoUrl: null, logoKey: null });
  });

  it("stores administrator gallery image data directly in the advertisement record", async () => {
    const inserts: any[] = [];
    const db = {
      insert: vi.fn(() => ({ values: async (values: any) => { inserts.push(values); return [{ insertId: 1 }]; } })),
    };
    mocks.getDb.mockResolvedValue(db);
    const mediaData = "data:image/png;base64,aGVsbG8=";

    await appRouter.createCaller(context(true)).admin.saveAd({
      packageTier: "bronze",
      title: "Gallery image ad",
      contentType: "image",
      mediaData,
      isActive: true,
    });

    expect(inserts[0]).toMatchObject({
      contentType: "image",
      mediaData,
    });
  });
});
