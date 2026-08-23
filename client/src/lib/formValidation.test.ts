import { describe, expect, it } from "vitest";
import {
  friendlyMessages,
  friendlyServerError,
  isValidPakistanMobileNumber,
  normalizePhoneNumber,
  validateDepositAmount,
  validateEmail,
  validatePassword,
  validateTransactionId,
  validateWithdrawalAmount,
} from "./formValidation";

describe("friendly form validation", () => {
  it("uses the requested amount messages for deposit and withdrawal fields", () => {
    expect(validateWithdrawalAmount("3001", "PKR")).toBe(
      friendlyMessages.withdrawalOverMaximum
    );
    expect(validateWithdrawalAmount("0", "PKR")).toBe(
      friendlyMessages.validAmount
    );
    expect(validateDepositAmount("99", "PKR")).toBe(
      friendlyMessages.depositMinimum
    );
    expect(validateDepositAmount("15001", "PKR")).toBe(
      friendlyMessages.depositMaximum
    );
  });

  it("validates email, password, TID, and Pakistani mobile-number format", () => {
    expect(validateEmail("not-an-email")).toBe(friendlyMessages.email);
    expect(validatePassword("short")).toBe(friendlyMessages.password);
    expect(validateTransactionId("?")).toBe(friendlyMessages.transactionId);
    expect(normalizePhoneNumber("+92 326 9337570")).toBe("03269337570");
    expect(isValidPakistanMobileNumber("03269337570")).toBe(true);
    expect(isValidPakistanMobileNumber("0123")).toBe(false);
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
