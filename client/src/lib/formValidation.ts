export type FormField =
  | "email"
  | "username"
  | "password"
  | "confirmPassword"
  | "amount"
  | "walletType"
  | "transactionId"
  | "accountDetails"
  | "senderAccountNumber"
  | "proof"
  | "general";

export type FormErrors = Partial<Record<FormField, string>>;

export const friendlyMessages = {
  withdrawalOverMaximum: "Please enter 3000 or less amount",
  validAmount: "Please enter a valid amount",
  depositMinimum: "Please deposit minimum 100 PKR",
  depositMaximum: "Maximum deposit is 15000 PKR",
  email: "You entered wrong Gmail/Email, please correct your Gmail",
  password: "Your password is incorrect/weak, please enter strong password",
  passwordMismatch: "Your passwords do not match, please enter same password",
  emailRegistered: "This Email/Gmail is already registered",
  usernameExists: "This username already exists, please choose another",
  singleAccount: "You cannot create multiple accounts on same device, only one account allowed per device",
  transactionId: "You entered wrong deposit number / Transaction ID, please enter correct TID",
  walletType: "Please select a wallet type",
  paymentNumber: "Please enter correct JazzCash number linked with account",
  proofRequired: "Please upload payment proof screenshot",
  requestFailed: "Please correct the highlighted field and try again.",
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
  if (!Number.isFinite(amount) || amount <= 0) return friendlyMessages.validAmount;
  if (amountPkr > 3000) return friendlyMessages.withdrawalOverMaximum;
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
  if (normalized.includes("3000") || normalized.includes("withdrawal amount"))
    return { amount: friendlyMessages.withdrawalOverMaximum };
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
  if (normalized.includes("account number") || normalized.includes("account details"))
    return { [preferredField]: friendlyMessages.paymentNumber };
  return { [preferredField]: friendlyMessages.requestFailed };
}
