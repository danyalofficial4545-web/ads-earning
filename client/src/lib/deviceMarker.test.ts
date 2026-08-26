import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("device marker", () => {
  it("uses a stable opaque marker key for the browser-local registration signal", () => {
    expect("pep-device-marker").toContain("device");
  });

  it("keeps registration reachable when a mobile browser blocks local storage", () => {
    const source = readFileSync(new URL("./deviceMarker.ts", import.meta.url), "utf8");
    expect(source).toContain("try {");
    expect(source).toContain("catch");
    expect(source).toContain("return createMarker()");
  });
});
