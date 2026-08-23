import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("member channel reward and withdrawal presentation", () => {
  it("shows an attractive channel-join prompt and routes a successful reward recipient to withdrawal", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
    const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

    expect(source).toContain("function WhatsAppJoinPrompt");
    expect(source).toContain('t("whatsappPromptTitle")');
    expect(source).toContain('setPage("withdrawal")');
    expect(source).toContain('t("whatsappWithdrawalPrompt")');
    expect(translations).toContain('whatsappPromptTitle: "Please Join WhatsApp Channel and Claim 10 Rupees & Instant Withdrawal"');
    expect(translations).toContain('whatsappWithdrawalPrompt: "Please withdraw your 10 PKR reward."');
  });

  it("does not render withdrawal limits, referral rule explanations, or numeric bounds in the withdrawal form", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
    const withdrawal = source.slice(
      source.indexOf("function Withdrawal"),
      source.indexOf("function Earn")
    );

    expect(withdrawal).not.toContain('t("withdrawLimit")');
    expect(withdrawal).not.toContain('t("inviteUnlock")');
    expect(withdrawal).not.toContain('t("withdrawalUnlocked")');
    expect(withdrawal).not.toContain('min={currency');
    expect(withdrawal).not.toContain('max={currency');
  });
});
