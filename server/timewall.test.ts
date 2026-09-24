import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { processTimewallPostback } from "./routers";

describe("Timewall Phase 3 safeguards", () => {
  it("rejects an invalid callback secret before database access", async () => {
    const result = await processTimewallPostback({ userId: "1", coins: "1000", secret: "wrong", transactionId: "tx-invalid-secret" });
    expect(result).toEqual({ status: 403, body: "FORBIDDEN" });
  });

  it("contains the required idempotent ten-percent reward flow", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(source).toContain("Math.floor(coinsReceived * 0.10)");
    expect(source).toContain("timewallPostbacks.transactionId");
    expect(source).toContain('type: "timewall_earning"');
    expect(source).toContain('type: "referral_task_reward"');
  });
});
