import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Admin Custom settings", () => {
  it("saves text settings separately from direct logo data", () => {
    const source = readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");

    expect(source).toContain("const saveText = trpc.admin.saveSettings.useMutation");
    expect(source).toContain("const saveLogo = trpc.admin.saveBrandLogo.useMutation");
    expect(source).toContain("saveText.mutate(values)");
    expect(source).toContain("saveLogo.mutate({ logoData })");
    expect(source).not.toContain("Storage config missing");
    expect(source).toContain('value="black"');
    expect(source).toContain('value="red"');
    expect(source).toContain('value="yellow"');
    expect(source).toContain('value="purple"');
    expect(source).toContain('value="teal"');
  });
});
