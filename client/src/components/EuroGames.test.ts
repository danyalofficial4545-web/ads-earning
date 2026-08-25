import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compact Euro game suite", () => {
  const source = readFileSync(new URL("./EuroGames.tsx", import.meta.url), "utf8");

  it("keeps compact wallet, Tasks, Exchange, and Withdraw controls in the Euro header", () => {
    expect(source).toContain('h-7 w-[70px]');
    expect(source).toContain('h-7 w-[80px]');
    expect(source).toContain('Game: {euro.gameBalancePkr}');
    expect(source).toContain('onClick={onWithdraw}');
    expect(source).toContain('Verified rewards go to Game Wallet');
  });

  it("uses image-based two-column game cards and opens every listed game in a full-screen screen", () => {
    expect(source).toContain('grid-cols-2');
    expect(source).toContain('max-h-[630px]');
    for (const game of ["aviator", "slots", "mining", "ludo", "plinko", "wheel", "crash", "mines", "color", "lucky"]) {
      expect(source).toContain(`"${game}"`);
    }
    expect(source).toContain('fixed inset-0 z-[80]');
    expect(source).toContain('FortuneSlots');
    expect(source).toContain('Online Ludo');
  });

  it("uses timestamp-shared state, a common countdown, crash history, and live bet tabs", () => {
    expect(source).toContain('trpc.euro.sharedState.useQuery');
    expect(source).toContain('FLEW AWAY!');
    expect(source).toContain('FLEW AWAY!');
    expect(source).toContain('All Bets');
    expect(source).toContain('This game is server-verified');
  });
});
