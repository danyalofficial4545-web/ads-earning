import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("automatic sponsor continuation", () => {
  it("uses a server-authorized five-second overlay and never synthesizes browser clicks", () => {
    const source = readFileSync(new URL("./AdminAdGate.tsx", import.meta.url), "utf8");

    expect(source).toContain("trpc.earning.startAdminAd.useMutation");
    expect(source).toContain("trpc.earning.completeAdminAd.useMutation");
    expect(source).toContain("setSeconds(5)");
    expect(source).toContain("placement: request.placement");
    expect(source).not.toContain("dispatchEvent");
    expect(source).not.toContain("element.click");
  });

  it("loads both administrator-supplied Adsterra scripts in the document head", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

    expect(html).toContain("c39394501da20cecb09000e829b5b01d.js");
    expect(html).toContain("b0f7854db95a963d43c8aa42ca3332f3.js");
  });
});
