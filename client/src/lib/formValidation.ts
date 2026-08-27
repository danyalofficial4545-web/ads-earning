export type FormField =
  | "email"
  | "username"
  | "password"
  | "confirmPassword"
  | "amount"
  | "walletType"
  | "accountName"
  | "transactionId"
  | "accountDetails"
  | "senderAccountNumber"
  | "proof"
  | "general";

export type FormErrors = Partial<Record<FormField, string>>;

export const friendlyMessages = {
  withdrawalMinimum: "Please enter a valid withdrawal amount, minimum withdrawal is 50 PKR",
  withdrawalZeroLimit: "Your withdrawal limit is zero, you cannot withdraw. Please purchase a package or invite friends to increase your limit",
  withdrawalRewardUsed: "You have already taken free withdrawal. Please purchase a package to continue earning and withdrawing. Your balance is zero, please buy a package",
  depositMinimum: "Please deposit minimum 100 PKR",
  depositMaximum: "Maximum deposit is 15000 PKR",
  email: "You entered wrong Gmail/Email, please correct your Gmail",
  password: "Your password is incorrect/weak, please enter strong password",
  passwordMismatch: "Your passwords do not match, please enter same password",
  emailRegistered: "This Email/Gmail is already registered",
  usernameExists: "This username already exists, please choose another",
  singleAccount: "You cannot create multiple accounts on same device, only one account allowed per device",
  transactionId: "You entered wrong deposit number / Transaction ID, please enter correct TID",
  walletType: "Please select your wallet type first - JazzCash, Easypaisa, SadaPay",
  walletName: "Please enter account holder name (wallet name)",
  paymentNumber: "Your wallet number is wrong/incomplete, please enter correct JazzCash/Easypaisa number",
  proofRequired: "Please upload payment proof screenshot",
  requestFailed: "Please review your information and try again.",
} as const;

export function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12)
    return `0${digits.slice(2)}`;
  return digits;
}

export function isValidPakistanMobileNumber(value: string) {
  return /^03\d{9}$/.test(normalizePhoneNumber(value));
}

export function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : friendlyMessages.email;
}

export function validatePassword(value: string) {
  return value.trim().length >= 8 ? undefined : friendlyMessages.password;
}

export function validateUsername(value: string) {
  return /^[A-Za-z0-9_]{3,32}$/.test(value.trim())
    ? undefined
    : "Please enter a username with 3–32 letters, numbers, or underscores.";
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  return password === confirmation ? undefined : friendlyMessages.passwordMismatch;
}

export function validateTransactionId(value: string) {
  return /^[A-Za-z0-9_-]{3,128}$/.test(value.trim())
    ? undefined
    : friendlyMessages.transactionId;
}

export function validateWithdrawalAmount(value: string, currency: "PKR" | "USD") {
  const amount = Number(value);
  const amountPkr = currency === "USD" ? Math.round(amount * 280) : amount;
  if (!Number.isFinite(amount) || amountPkr < 50)
    return friendlyMessages.withdrawalMinimum;
  return undefined;
}

export function withdrawalLimitMessage(limitPkr: number) {
  const allowed = Math.max(0, Math.min(limitPkr, 3000));
  return `You entered amount more than your limit. Maximum withdrawal is 3000 PKR and your limit is PKR ${limitPkr}. Please enter PKR ${allowed} or less`;
}

export type WithdrawalFailure = {
  field: FormField;
  message: string;
};

export function firstWithdrawalFailure(input: {
  amount: string;
  currency: "PKR" | "USD";
  withdrawalLimitPkr: number;
  activePackage: boolean;
  pendingChannelReward: boolean;
  freeWithdrawalCompleted: boolean;
  walletType: string;
  accountName: string;
  accountDetails: string;
}): WithdrawalFailure | undefined {
  if (input.freeWithdrawalCompleted && !input.activePackage)
    return { field: "amount", message: friendlyMessages.withdrawalRewardUsed };
  if (input.withdrawalLimitPkr <= 0)
    return { field: "amount", message: friendlyMessages.withdrawalZeroLimit };

  const enteredAmount = Number(input.amount);
  const amountPkr =
    input.currency === "USD" ? Math.round(enteredAmount * 280) : enteredAmount;
  if (
    Number.isFinite(enteredAmount) &&
    amountPkr >= 50 &&
    (amountPkr > 3000 || amountPkr > input.withdrawalLimitPkr)
  )
    return {
      field: "amount",
      message: withdrawalLimitMessage(input.withdrawalLimitPkr),
    };
  if (
    (!Number.isFinite(enteredAmount) || amountPkr < 50) &&
    !(input.pendingChannelReward && amountPkr === 10)
  )
    return { field: "amount", message: friendlyMessages.withdrawalMinimum };
  if (!input.walletType)
    return { field: "walletType", message: friendlyMessages.walletType };
  if (!input.accountName.trim())
    return { field: "accountName", message: friendlyMessages.walletName };
  if (
    !input.accountDetails.trim() ||
    (input.currency === "PKR" && !isValidPakistanMobileNumber(input.accountDetails))
  )
    return { field: "accountDetails", message: friendlyMessages.paymentNumber };
  return undefined;
}

export function validateDepositAmount(value: string, currency: "PKR" | "USD") {
  const amount = Number(value);
  const amountPkr = currency === "USD" ? Math.round(amount * 280) : amount;
  if (!Number.isFinite(amount) || amount <= 0 || amountPkr < 100)
    return friendlyMessages.depositMinimum;
  if (amountPkr > 15000) return friendlyMessages.depositMaximum;
  return undefined;
}

export function friendlyServerError(
  error: unknown,
  preferredField: FormField = "general"
): FormErrors {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("email") && normalized.includes("password"))
    return { email: friendlyMessages.email, password: friendlyMessages.password };
  if (
    normalized.includes("email") &&
    (normalized.includes("already exists") || normalized.includes("registered"))
  )
    return { email: friendlyMessages.emailRegistered };
  if (normalized.includes("username") && (normalized.includes("already") || normalized.includes("in use")))
    return { username: friendlyMessages.usernameExists };
  if (normalized.includes("one account") || normalized.includes("device") || normalized.includes("network"))
    return { username: friendlyMessages.singleAccount };
  if (normalized.includes("withdrawal limit is zero"))
    return { amount: friendlyMessages.withdrawalZeroLimit };
  if (normalized.includes("already taken free withdrawal"))
    return { amount: friendlyMessages.withdrawalRewardUsed };
  if (normalized.includes("minimum withdrawal") || normalized.includes("valid withdrawal amount"))
    return { amount: friendlyMessages.withdrawalMinimum };
  if (normalized.includes("maximum withdrawal") || normalized.includes("more than your limit"))
    return { amount: message || friendlyMessages.requestFailed };
  if (normalized.includes("deposit") && normalized.includes("100"))
    return { amount: friendlyMessages.depositMinimum };
  if (normalized.includes("deposit") && normalized.includes("15000"))
    return { amount: friendlyMessages.depositMaximum };
  if (normalized.includes("email") || normalized.includes("gmail"))
    return { email: friendlyMessages.email };
  if (normalized.includes("password")) return { password: friendlyMessages.password };
  if (normalized.includes("transaction") || normalized.includes("tid"))
    return { transactionId: friendlyMessages.transactionId };
  if (normalized.includes("wallet type"))
    return { walletType: friendlyMessages.walletType };
  if (normalized.includes("account holder") || normalized.includes("wallet name"))
    return { accountName: friendlyMessages.walletName };
  if (
    normalized.includes("wallet number") ||
    normalized.includes("jazzcash") ||
    normalized.includes("easypaisa") ||
    normalized.includes("account number") ||
    normalized.includes("account details")
  )
    return { accountDetails: friendlyMessages.paymentNumber };
  return { [preferredField]: friendlyMessages.requestFailed };
}
