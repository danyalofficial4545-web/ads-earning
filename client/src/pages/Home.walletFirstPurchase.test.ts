import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("wallet-first package purchase flow", () => {
  it("uses the protected package purchase mutation when the wallet covers the tier", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("const purchasePackage = trpc.package.buy.useMutation");
    expect(source).toContain("if (balance >= plan.pricePkr)");
    expect(source).toContain("purchasePackage.mutate({ packageId: plan.id })");
  });

  it("opens a visible deficit dialog and prefills only the required package deposit", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [depositAmount, setDepositAmount] = useState(\"\")");
    expect(source).toContain("const [shortfallPlan, setShortfallPlan] = useState<any>(null)");
    expect(source).toContain("onRequestDeposit(shortfallPlan, shortfall)");
    expect(source).toContain("initialAmount={depositAmount}");
  });

  it("sorts the visible package catalog by ascending PKR price", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("const orderedPlans = [...plans].sort((a, b) => a.pricePkr - b.pricePkr)");
  });
});
