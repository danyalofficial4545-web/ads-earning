import { describe, expect, it } from "vitest";
import {
  firstWithdrawalFailure,
  friendlyMessages,
  friendlyServerError,
  isValidPakistanMobileNumber,
  normalizePhoneNumber,
  validateDepositAmount,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateTransactionId,
} from "./formValidation";

describe("friendly form validation", () => {
  it("uses the requested amount messages for deposit fields", () => {
    expect(validateDepositAmount("99", "PKR")).toBe(
      friendlyMessages.depositMinimum
    );
    expect(validateDepositAmount("15001", "PKR")).toBe(
      friendlyMessages.depositMaximum
    );
  });

  it("returns the first exact withdrawal failure for account state, amount, and wallet fields", () => {
    const base = {
      currency: "PKR" as const,
      withdrawalLimitPkr: 300,
      activePackage: true,
      pendingChannelReward: false,
      freeWithdrawalCompleted: false,
      walletType: "JazzCash",
      accountName: "Member Name",
      accountDetails: "03001234567",
    };
    expect(
      firstWithdrawalFailure({ ...base, amount: "500", withdrawalLimitPkr: 0 })
    ).toEqual({ field: "amount", message: friendlyMessages.withdrawalZeroLimit });
    expect(
      firstWithdrawalFailure({
        ...base,
        amount: "500",
        activePackage: false,
        freeWithdrawalCompleted: true,
      })
    ).toEqual({ field: "amount", message: friendlyMessages.withdrawalRewardUsed });
    expect(firstWithdrawalFailure({ ...base, amount: "500" })?.message).toContain(
      "your limit is PKR 300"
    );
    expect(firstWithdrawalFailure({ ...base, amount: "20" })).toEqual({
      field: "amount",
      message: friendlyMessages.withdrawalMinimum,
    });
    expect(firstWithdrawalFailure({ ...base, amount: "100", walletType: "" })).toEqual({
      field: "walletType",
      message: friendlyMessages.walletType,
    });
    expect(firstWithdrawalFailure({ ...base, amount: "100", accountName: "" })).toEqual({
      field: "accountName",
      message: friendlyMessages.walletName,
    });
    expect(firstWithdrawalFailure({ ...base, amount: "100", accountDetails: "0123" })).toEqual({
      field: "accountDetails",
      message: friendlyMessages.paymentNumber,
    });
  });

  it("validates email, password, TID, and Pakistani mobile-number format", () => {
    expect(validateEmail("not-an-email")).toBe(friendlyMessages.email);
    expect(validatePassword("short")).toBe(friendlyMessages.password);
    expect(validatePasswordConfirmation("password1", "password2")).toBe(
      "Your passwords do not match, please enter same password"
    );
    expect(validateTransactionId("?")).toBe(friendlyMessages.transactionId);
    expect(normalizePhoneNumber("+92 326 9337570")).toBe("03269337570");
    expect(isValidPakistanMobileNumber("03269337570")).toBe(true);
    expect(isValidPakistanMobileNumber("0123")).toBe(false);
  });

  it("maps the attached specific registration failures to their matching fields", () => {
    expect(friendlyServerError(new Error("This Email/Gmail is already registered"))).toEqual({
      email: friendlyMessages.emailRegistered,
    });
    expect(friendlyServerError(new Error("This username already exists, please choose another"))).toEqual({
      username: friendlyMessages.usernameExists,
    });
    expect(friendlyServerError(new Error("You cannot create multiple accounts on same device, only one account allowed per device"))).toEqual({
      username: friendlyMessages.singleAccount,
    });
    expect(friendlyMessages.passwordMismatch).toBe(
      "Your passwords do not match, please enter same password"
    );
  });

  it("never returns raw backend text to a member form", () => {
    expect(friendlyServerError(new Error("Internal Server Error: stack trace"))).toEqual({
      general: friendlyMessages.requestFailed,
    });
    expect(friendlyServerError(new Error("invalid email"))).toEqual({
      email: friendlyMessages.email,
    });
    expect(friendlyServerError(new Error("Incorrect email or password"))).toEqual({
      email: friendlyMessages.email,
      password: friendlyMessages.password,
    });
  });
});
