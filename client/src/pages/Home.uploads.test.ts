import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("member upload errors", () => {
  it("uses the generic bilingual failure message for deposit proof and support screenshot uploads", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("function Deposit({ t, settings, packages, onDone, initialRequestedPackageId = \"\" }: any)");
    expect(source).toContain("function Support({ t }: any)");
    expect(source).toContain('onError: () => toast.error(t("operationFailed"))');
    expect(source).not.toContain("Storage config missing");
  });
});
