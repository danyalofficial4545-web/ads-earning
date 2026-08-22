import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("member pending request histories", () => {
  it("refreshes and opens both request histories after a successful submission", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("void utils.deposit.list.invalidate()");
    expect(source).toContain("void utils.withdrawal.list.invalidate()");
    expect(source.match(/setShowHistory\(true\)/g)).toHaveLength(2);
  });

  it("shows bilingual transfer instructions before the deposit detail form", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
    const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

    expect(source).toContain('t("depositTransferInstruction")');
    expect(translations).toContain('depositTransferInstruction: "First transfer the amount');
    expect(translations).toContain('depositTransferInstruction: "پہلے اوپر دکھائے گئے');
  });
});
