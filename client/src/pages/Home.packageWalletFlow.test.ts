import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package-gated wallet and withdrawal flow", () => {
  const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

  it("shows a zero-balance package prompt and disables withdrawal entry until an active package exists", () => {
    expect(source).toContain('money(overview.data?.profile.balancePkr ?? 0)');
    expect(source).toContain('disabled={!canWithdraw}');
    expect(source).toContain('hasPendingChannelReward');
    expect(source).toContain('t("noPackageBalanceMessage")');
    expect(source).toContain('function Withdrawal({ t, profile, showRewardWithdrawalPrompt, activePackage, hasPendingChannelReward, rewardWithdrawalCompleted, onRewardWithdrawalSubmitted, onDone }: any)');
    expect(source).toContain('!activePackage && !hasPendingChannelReward');
  });

  it("keeps the completed free-reward no-package case in the form so its exact reason can appear inline", () => {
    expect(source).toContain('freeWithdrawalCompleted: Boolean(rewardWithdrawalCompleted)');
    expect(source).toContain('toast.error(failure.message)');
  });

  it("collects wallet type, holder name, wallet number, and amount in the withdrawal form", () => {
    expect(source).toContain('const [walletType, setWalletType] = useState("")');
    expect(source).toContain('t("walletType")');
    expect(source).toContain('t("walletAccountName")');
    expect(source).toContain('t("walletNumber")');
    expect(source).toContain('walletType: walletType as');
  });

  it("derives reward guidance from persisted completion state while retaining immediate join guidance", () => {
    expect(source).toContain('profile.whatsappRewardEligible &&');
    expect(source).toContain('memberProfile.whatsappBonusClaimed &&');
    expect(source).toContain('!rewardWithdrawalRequested');
    expect(source).toContain('setPage("withdrawal")');
  });
});
