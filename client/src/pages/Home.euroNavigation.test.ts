import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Euro workspace navigation", () => {
  const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

  it("renders Euro through the authenticated workspace at the real /euro route", () => {
    expect(appSource).toContain('path={"/euro"} component={Home}');
    expect(source).toContain('location === "/euro" ? "euro" : "dashboard"');
    expect(source).toContain('navigate(next === "euro" ? "/euro" : "/")');
    expect(source).toContain('euro: <EuroGames t={t} />');
  });

  it("keeps an Exchange to Game Wallet entry in the main profile wallet", () => {
    expect(source).toContain('t("exchangeToGame")');
    expect(source).toContain('setPage("euro")');
  });
});
