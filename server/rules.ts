export const WITHDRAWAL_LOCK_MESSAGE = "Please invite someone to unlock withdrawal. Your 50% referral commission will be added to your withdraw limit.";
export const AD_TIMER_MESSAGE = "⚠️ Please watch the full ad for at least 30 seconds before claiming your reward!";
export const DESIGNATED_ADMIN_EMAIL = "muhammaddanyal4545@gmail.com";
export const DESIGNATED_ADMIN_USERNAME = "danyal955163";

export function toPkr(amount: number, currency: "PKR" | "USD", exchangeRate: number) {
  return currency === "PKR" ? Math.round(amount) : Math.round(amount * exchangeRate);
}

export function fromPkr(amountPkr: number, exchangeRate: number) {
  return Number((amountPkr / exchangeRate).toFixed(2));
}

export function referralLimitCredit(packagePricePkr: number, commissionPercent: number) {
  return Math.floor((packagePricePkr * commissionPercent) / 100);
}

export function validateWithdrawalRequest(input: {
  balancePkr: number;
  withdrawalLimitPkr: number;
  amountPkr: number;
  minimumWithdrawalPkr: number;
  maximumWithdrawalPkr: number;
}) {
  if (input.withdrawalLimitPkr < 50) return WITHDRAWAL_LOCK_MESSAGE;
  if (input.amountPkr < input.minimumWithdrawalPkr || input.amountPkr > input.maximumWithdrawalPkr) {
    return `Withdrawal amount must be between PKR ${input.minimumWithdrawalPkr} and PKR ${input.maximumWithdrawalPkr}.`;
  }
  if (input.amountPkr > input.withdrawalLimitPkr) return `Your current withdrawal limit is PKR ${input.withdrawalLimitPkr}. Invite friends to unlock more withdrawal limit.`;
  if (input.amountPkr > input.balancePkr) return "Your wallet balance is insufficient for this withdrawal request.";
  return null;
}

export function canClaimAd(startedAt: Date, now: Date, timerSeconds: number) {
  return now.getTime() >= startedAt.getTime() + timerSeconds * 1000;
}

export function isDesignatedAdministrator(email: string | null | undefined, username: string) {
  return email?.toLowerCase() === DESIGNATED_ADMIN_EMAIL && username === DESIGNATED_ADMIN_USERNAME;
}

export function canUseMemberWorkspace(isBlocked: boolean) {
  return !isBlocked;
}

export function matchesRequestTransaction(referenceType: string | null, referenceId: number | null, expectedType: string, expectedId: number) {
  return referenceType === expectedType && referenceId === expectedId;
}

export const DEPOSIT_MIN_PKR = 100;
export const DEPOSIT_MAX_PKR = 1000;
export const WITHDRAWAL_MIN_PKR = 50;
export const WITHDRAWAL_MAX_PKR = 3000;

export function validateDepositAmountPkr(amountPkr: number) {
  if (amountPkr < DEPOSIT_MIN_PKR || amountPkr > DEPOSIT_MAX_PKR) return `Deposit Limit: ${DEPOSIT_MIN_PKR} PKR to ${DEPOSIT_MAX_PKR} PKR.`;
  return null;
}
