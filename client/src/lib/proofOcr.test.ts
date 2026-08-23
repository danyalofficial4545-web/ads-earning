import { describe, expect, it } from "vitest";
import {
  extractPakistanMobileNumbers,
  proofContainsAccountNumber,
} from "./proofOcr";

describe("payment proof account-number matching", () => {
  it("extracts normal and country-code Pakistani mobile-number forms", () => {
    expect(
      extractPakistanMobileNumbers("Paid from 0326-9337570 and +92 333 1234567")
    ).toEqual(["03269337570", "03331234567"]);
  });

  it("requires the entered account number to be present in the extracted proof", () => {
    const proofNumbers = ["03269337570"];
    expect(proofContainsAccountNumber(proofNumbers, "0326 9337570")).toBe(true);
    expect(proofContainsAccountNumber(proofNumbers, "03001234567")).toBe(false);
  });
});
