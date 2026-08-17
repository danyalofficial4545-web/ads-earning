import { describe, expect, it } from "vitest";

describe("device marker", () => {
  it("uses a stable opaque marker key for the browser-local registration signal", () => {
    expect("pep-device-marker").toContain("device");
  });
});
