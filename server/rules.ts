export const WITHDRAWAL_LOCK_MESSAGE =
  "Please invite someone. When your invited user buys a package, 50% of his package price will be added to your withdraw limit.";
export const WITHDRAWAL_NO_PACKAGE_MESSAGE =
  "Your balance is zero, please purchase a package and start earning";
export const AD_TIMER_MESSAGE = "Please wait for the 10-second timer before claiming this reward.";
export const AD_REWARD_PKR = 20;
export const WHATSAPP_JOIN_REWARD_PKR = 10;
export const WITHDRAWAL_MAX_PKR = 3000;
export const WITHDRAWAL_MAX_MESSAGE =
  "Please enter 3000 or less amount";
export const WITHDRAWAL_INVALID_AMOUNT_MESSAGE = "Please enter a valid amount";
export const DESIGNATED_ADMIN_EMAIL = "muhammaddanyal4545@gmail.com";
export const DESIGNATED_ADMIN_USERNAME = "danyal955163";

export function toPkr(
  amount: number,
  currency: "PKR" | "USD",
  exchangeRate: number
) {
  return currency === "PKR"
    ? Math.round(amount)
    : Math.round(amount * exchangeRate);
}

export function fromPkr(amountPkr: number, exchangeRate: number) {
  return Number((amountPkr / exchangeRate).toFixed(2));
}

export function referralLimitCredit(
  packagePricePkr: number,
  commissionPercent: number
) {
  return Math.floor((packagePricePkr * commissionPercent) / 100);
}

export function applyWithdrawalRequest(balancePkr: number, amountPkr: number) {
  return { balancePkr: balancePkr - amountPkr, withdrawalLimitPkr: 0 };
}

export function refundRejectedWithdrawal(
  balancePkr: number,
  amountPkr: number
) {
  return balancePkr + amountPkr;
}

export function validateWithdrawalRequest(input: {
  balancePkr: number;
  withdrawalLimitPkr: number;
  amountPkr: number;
  activePackage?: boolean;
}) {
  if (input.amountPkr <= 0) return WITHDRAWAL_INVALID_AMOUNT_MESSAGE;
  if (input.amountPkr > WITHDRAWAL_MAX_PKR) return WITHDRAWAL_MAX_MESSAGE;
  if (input.withdrawalLimitPkr <= 0)
    return input.activePackage === false
      ? WITHDRAWAL_NO_PACKAGE_MESSAGE
      : WITHDRAWAL_LOCK_MESSAGE;
  if (input.amountPkr > input.withdrawalLimitPkr)
    return `Your current withdrawal limit is PKR ${input.withdrawalLimitPkr}. Invite friends to unlock more withdrawal limit.`;
  if (input.amountPkr > input.balancePkr)
    return "Your wallet balance is insufficient for this withdrawal request.";
  return null;
}

export function canClaimAd(startedAt: Date, now: Date, timerSeconds: number) {
  return now.getTime() >= startedAt.getTime() + timerSeconds * 1000;
}

export function getAdClaimStatus(input: {
  startedAt: Date;
  lastHeartbeatAt: Date;
  invalidatedAt: Date | null;
  now: Date;
  timerSeconds: number;
}) {
  return canClaimAd(input.startedAt, input.now, input.timerSeconds)
    ? ("claimable" as const)
    : ("early" as const);
}

export function isDesignatedAdministrator(
  email: string | null | undefined,
  username: string
) {
  return (
    email?.toLowerCase() === DESIGNATED_ADMIN_EMAIL &&
    username === DESIGNATED_ADMIN_USERNAME
  );
}

export function canUseMemberWorkspace(isBlocked: boolean) {
  return !isBlocked;
}

export function matchesRequestTransaction(
  referenceType: string | null,
  referenceId: number | null,
  expectedType: string,
  expectedId: number
) {
  return referenceType === expectedType && referenceId === expectedId;
}

export const DEPOSIT_MIN_PKR = 100;
export const DEPOSIT_MAX_PKR = 15000;
export const WITHDRAWAL_MIN_PKR = 0;

export function normalizePakistanMobileNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("92") && digits.length === 12
    ? `0${digits.slice(2)}`
    : digits;
}

export function isValidPakistanMobileNumber(value: string) {
  return /^03\d{9}$/.test(normalizePakistanMobileNumber(value));
}

export function validateDepositAmountPkr(amountPkr: number) {
  if (amountPkr < DEPOSIT_MIN_PKR)
    return "Please deposit minimum 100 PKR";
  if (amountPkr > DEPOSIT_MAX_PKR)
    return "Maximum deposit is 15000 PKR";
  return null;
}
