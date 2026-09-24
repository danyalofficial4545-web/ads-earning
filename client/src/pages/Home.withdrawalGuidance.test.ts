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

  it("checks the Earning Wallet before submitting a withdrawal", () => {
    expect(source).toContain("(profile.earningWalletBalance ?? 0) <= 0");
    expect(source).toContain("withdrawalLimitPkr: Math.floor((profile.earningWalletBalance ?? 0) / 100)");
  });
});
