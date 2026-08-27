import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator route dashboards", () => {
  it("maps Users, Deposits and Withdrawals to separate protected locations", () => {
    const source = readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");

    expect(source).toContain('users: "/admin/users"');
    expect(source).toContain('depositHistory: "/admin/deposits"');
    expect(source).toContain('withdrawalHistory: "/admin/withdraws"');
    expect(source).toContain('"/admin/withdrawals": "withdrawalHistory"');
    expect(source).toContain('packages: "/admin/packages"');
    expect(source).toContain('ads: "/admin/ads"');
    expect(source).toContain('settings: "/admin/settings"');
    expect(source).toContain("const [location, navigate] = useLocation()");
  });

  it("keeps searchable financial records and visible clipboard controls", () => {
    const source = readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [statusFilter, setStatusFilter] = useState(\"all\")");
    expect(source).toContain("function CopyRecordValue");
    expect(source).toContain('label={t("transactionId")}');
    expect(source).toContain('label={t("copyNumber")}');
    expect(source).toContain('label={t("copyDetails")}');
  });
});
