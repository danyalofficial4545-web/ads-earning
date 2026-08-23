import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package-gated wallet and withdrawal flow", () => {
  const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

  it("shows a zero-balance package prompt and disables withdrawal entry until an active package exists", () => {
    expect(source).toContain('money(overview.data?.profile.balancePkr ?? 0)');
    expect(source).toContain('disabled={!active}');
    expect(source).toContain('disabled={!canWithdraw}');
    expect(source).toContain('t("noPackageBalanceMessage")');
    expect(source).toContain('function Withdrawal({ t, showRewardWithdrawalPrompt, activePackage, onDone }: any)');
  });

  it("collects wallet type, holder name, wallet number, and amount in the withdrawal form", () => {
    expect(source).toContain('const [walletType, setWalletType] = useState("")');
    expect(source).toContain('t("walletType")');
    expect(source).toContain('t("walletAccountName")');
    expect(source).toContain('t("walletNumber")');
    expect(source).toContain('walletType: walletType as');
  });

  it("derives reward guidance from persisted completion state while retaining immediate join guidance", () => {
    expect(source).toContain('profile.whatsappBonusClaimed && !profile.whatsappRewardWithdrawn');
    expect(source).toContain('setRewardPromptJustEarned(true)');
  });
});
