import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Invite page copy", () => {
  it("does not render the referral reward placement explanation", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
    const inviteSection = source.slice(source.indexOf("function Invite"), source.indexOf("function Support"));

    expect(inviteSection).not.toContain('description={t("referralSubtitle")}');
  });
});
