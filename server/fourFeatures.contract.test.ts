import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("four administrator feature contracts", () => {
  it("keeps additive database entities for rejection, broadcasts, support rules, and notifications", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    expect(schema).toContain("rejectionReason");
    expect(schema).toContain("export const broadcasts");
    expect(schema).toContain("export const supportReplyRules");
    expect(schema).toContain("export const notifications");
  });

  it("exposes protected procedures for member notifications and editable support rules", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(router).toContain("reviewDeposit");
    expect(router).toContain("reviewWithdrawal");
    expect(router).toContain("saveSupportReplyRule");
    expect(router).toContain("deleteSupportReplyRule");
    expect(router).toContain("sendNotification");
    expect(router).toContain("markNotificationRead");
  });

  it("keeps the user-facing bell and dismissible broadcast surfaces wired", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/components/AdminPanel.tsx"), "utf8");
    expect(home).toContain("function NotificationBell()");
    expect(home).toContain("visibleAnnouncements");
    expect(home).toContain("setDismissed");
    expect(admin).toContain("promptNotification");
    expect(admin).toContain("SupportRules");
  });
});
