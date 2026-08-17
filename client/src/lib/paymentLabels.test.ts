import { describe, expect, it } from "vitest";
import { dictionaries } from "./i18n";

describe("custom payment labels", () => {
  it("uses generic USD labels and leaves the payment method to administrator-entered account data", () => {
    expect(dictionaries.en.usd).toBe("USD");
    expect(dictionaries.ur.usd).toBe("USD");
    expect(dictionaries.en.walletBalance).toBe("Wallet balance (PKR and USD)");
    expect(dictionaries.ur.walletBalance).toBe("والٹ بیلنس (PKR اور USD)");
    expect(Object.values(dictionaries.en).join(" ")).not.toContain("PayPal");
    expect(Object.values(dictionaries.ur).join(" ")).not.toContain("PayPal");
  });
});
