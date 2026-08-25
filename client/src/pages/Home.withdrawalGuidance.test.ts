import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("one-time withdrawal guidance priority", () => {
  const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
  const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../index.css", import.meta.url), "utf8");

  it("replaces a completed reward prompt with the requested green package guidance until a package is active", () => {
    expect(source).toContain("rewardWithdrawalCompleted && !activePackage");
    expect(source).toContain('t("postRewardBalanceMessage")');
    expect(translations).toContain('postRewardBalanceMessage: "Please purchase a package to start earning, after that you will get withdrawal"');
    expect(translations).toContain('postRewardBalanceMessage: "برائے مہربانی ایک پیکج خریدیں جس سے آپ کو ارننگ ہوگی اس کے بعد آپ کو ودڈرا ملے گا"');
  });

  it("shows the invite ticker only for active packages with a zero withdrawal limit and stops it after six seconds", () => {
    expect(source).toContain("activePackage && profile.withdrawalLimitPkr <= 0");
    expect(source).toContain("window.setTimeout(() => setShowInviteTicker(false), 6_000)");
    expect(source).toContain('t("withdrawalInviteTicker")');
    expect(translations).toContain('withdrawalInviteTicker: "Please invite someone and 50% of his package will go to your withdrawal limit"');
    expect(translations).toContain('withdrawalInviteTicker: "برائے مہربانی کسی کو انوائٹ کریں اور اس کے پیکج کا 50 فیصد آپ کی ودڈرا لمٹ میں آئے گا"');
    expect(styles).toContain("animation: withdrawal-invite-ticker-ltr 6s linear both");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});
