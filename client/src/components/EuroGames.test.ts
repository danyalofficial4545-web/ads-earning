import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compact Euro game suite", () => {
  const source = readFileSync(new URL("./EuroGames.tsx", import.meta.url), "utf8");

  it("keeps compact wallet, Tasks, Exchange, and Withdraw controls in the Euro header", () => {
    expect(source).toContain('h-7 w-[70px]');
    expect(source).toContain('h-7 w-[80px]');
    expect(source).toContain('Game: {euro.gameBalancePkr} PKR');
    expect(source).toContain('onClick={onWithdraw}');
    expect(source).toContain('Please complete tasks and get reward into Game Wallet');
  });

  it("uses image-based two-column game cards and opens every listed game in a full-screen screen", () => {
    expect(source).toContain('grid-cols-2');
    expect(source).toContain('max-h-[630px]');
    for (const game of ["aviator", "slots", "mining", "ludo", "plinko", "wheel", "crash", "mines", "color", "lucky"]) {
      expect(source).toContain(`"${game}"`);
    }
    expect(source).toContain('fixed inset-0 z-[80]');
    expect(source).toContain('GenericGame');
  });

  it("holds Aviator crash status for three seconds before refreshing a ready round", () => {
    expect(source).toContain('Crashed at ${mult.toFixed(2)}x');
    expect(source).toContain('window.setTimeout(() => { setCrashNotice(null); void refresh(); }, 3000)');
    expect(source).toContain('Math.min(100');
  });
});
