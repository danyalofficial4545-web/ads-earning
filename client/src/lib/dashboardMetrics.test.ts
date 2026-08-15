import { describe, expect, it } from "vitest";
import { dashboardMetricKeys } from "./dashboardMetrics";

describe("dashboard metric visibility", () => {
  it("does not show withdrawal limit in the main dashboard metrics", () => {
    expect(dashboardMetricKeys).toEqual(["balance", "adsToday", "totalEarned"]);
    expect(dashboardMetricKeys).not.toContain("withdrawalLimit");
  });
});
