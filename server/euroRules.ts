import { randomInt } from "node:crypto";

export const EURO_DEFAULT_BONUS_PKR = 100;
export const EURO_MINIMUM_BET_PKR = 16;
export const EURO_MAXIMUM_BET_PKR = 20_000;
export const EURO_DEFAULT_CRASH_WEIGHTS = "50,30,10,5,5";
export const AVIATOR_PREFLIGHT_MS = 3_000;
export const AVIATOR_GROWTH_MS = 7_500;

export const EURO_GENERIC_GAME_KEYS = [
  "slots",
  "mining",
  "ludo",
  "wheel",
  "plinko",
  "color",
  "lucky",
] as const;

export type EuroGenericGameKey = (typeof EURO_GENERIC_GAME_KEYS)[number];
export type GenericGameOutcome = {
  multiplierX100: number;
  publicState: Record<string, unknown>;
  privateState?: Record<string, unknown>;
};

export type CrashBand = {
  minX100: number;
  maxX100: number;
  weight: number;
};

const crashRanges: Array<[number, number]> = [
  [110, 150],
  [151, 500],
  [501, 2_000],
  [2_001, 5_000],
  [5_001, 10_000],
];

export function parseCrashBandWeights(raw: string): number[] {
  const weights = raw.split(",").map(value => Number(value.trim()));
  if (
    weights.length !== 5 ||
    weights.some(weight => !Number.isInteger(weight) || weight < 0) ||
    weights.reduce((total, weight) => total + weight, 0) !== 100
  )
    throw new Error("Crash-band weights must contain five whole numbers totaling 100.");
  return weights;
}

export function crashBands(raw = EURO_DEFAULT_CRASH_WEIGHTS): CrashBand[] {
  const weights = parseCrashBandWeights(raw);
  return crashRanges.map(([minX100, maxX100], index) => ({
    minX100,
    maxX100,
    weight: weights[index] ?? 0,
  }));
}

export function chooseCrashMultiplierX100(
  rawWeights = EURO_DEFAULT_CRASH_WEIGHTS,
  randomNumber = randomInt(100),
  randomWithinBand: (maxExclusive: number) => number = randomInt
) {
  const bands = crashBands(rawWeights);
  let cursor = 0;
  const band = bands.find(item => {
    cursor += item.weight;
    return randomNumber < cursor;
  }) ?? bands[bands.length - 1];
  if (!band) throw new Error("No Aviator crash band is configured.");
  return band.minX100 + randomWithinBand(band.maxX100 - band.minX100 + 1);
}

export function multiplierAt(now: Date, startsAt: Date) {
  const elapsedMs = Math.max(0, now.getTime() - startsAt.getTime() - AVIATOR_PREFLIGHT_MS);
  return Math.max(100, Math.floor(Math.exp(elapsedMs / AVIATOR_GROWTH_MS) * 100));
}

export function crashTimeFor(startsAt: Date, crashMultiplierX100: number) {
  const elapsedMs = Math.ceil(
    Math.log(Math.max(1, crashMultiplierX100 / 100)) * AVIATOR_GROWTH_MS
  );
  return new Date(startsAt.getTime() + AVIATOR_PREFLIGHT_MS + elapsedMs);
}

export function validateEuroBetAmount(
  amountPkr: number,
  minimumPkr = EURO_MINIMUM_BET_PKR,
  maximumPkr = EURO_MAXIMUM_BET_PKR,
  gameLabel = "Aviator"
) {
  if (!Number.isInteger(amountPkr) || amountPkr < minimumPkr)
    return `Minimum ${gameLabel} bet is ${minimumPkr} PKR.`;
  if (amountPkr > maximumPkr)
    return `Maximum ${gameLabel} bet is ${maximumPkr.toLocaleString()} PKR.`;
  return null;
}

function weightedMultiplier(
  chance: number,
  bands: Array<[upperExclusive: number, multiplierX100: number]>
) {
  return bands.find(([upper]) => chance < upper)?.[1] ?? 0;
}

export function chooseGenericGameOutcome(input: {
  gameKey: Exclude<EuroGenericGameKey, "mining">;
  selection?: string | null;
  randomPercent?: number;
  randomInteger?: (maxExclusive: number) => number;
}): GenericGameOutcome {
  const randomPercent = input.randomPercent ?? randomInt(100);
  const randomInteger = input.randomInteger ?? randomInt;
  if (input.gameKey === "slots") {
    const multiplierX100 = weightedMultiplier(randomPercent, [
      [50, 0],
      [80, 500],
      [95, 1_000],
      [99, 2_000],
      [100, 5_000],
    ]);
    const icons = multiplierX100 ? ["7", "7", "7"] : ["7", "★", "♦"].sort(() => randomInteger(2) - 0.5);
    return { multiplierX100, publicState: { reels: icons } };
  }
  if (input.gameKey === "wheel") {
    const multiplierX100 = weightedMultiplier(randomPercent, [
      [15, 0],
      [55, 150],
      [85, 200],
      [95, 500],
      [99, 1_000],
      [100, 5_000],
    ]);
    return { multiplierX100, publicState: { multiplierX100 } };
  }
  if (input.gameKey === "plinko") {
    const multiplierX100 = chooseCrashMultiplierX100(
      EURO_DEFAULT_CRASH_WEIGHTS,
      randomPercent,
      randomInteger
    );
    return { multiplierX100, publicState: { multiplierX100 } };
  }
  if (input.gameKey === "ludo") {
    const selected = Number(input.selection);
    const rolled = randomInteger(6) + 1;
    return {
      multiplierX100: selected === rolled ? 500 : 0,
      publicState: { rolled, selected },
    };
  }
  if (input.gameKey === "color") {
    const selected = input.selection === "green" ? "green" : "red";
    const won = randomPercent < 48;
    const result = won ? selected : selected === "red" ? "green" : "red";
    return {
      multiplierX100: won ? 190 : 0,
      publicState: { selected, result },
    };
  }
  const selected = Number(input.selection);
  const result = randomInteger(10);
  return {
    multiplierX100: selected === result ? 900 : 0,
    publicState: { selected, result },
  };
}

export function createMiningState(
  randomInteger: (maxExclusive: number) => number = randomInt
) {
  const bombs = new Set<number>();
  while (bombs.size < 5) bombs.add(randomInteger(25));
  return { bombs: Array.from(bombs).sort((a, b) => a - b), revealed: [] as number[] };
}

export function miningMultiplierX100(revealedSafeTiles: number) {
  return 100 + Math.max(0, revealedSafeTiles) * 30;
}

export function validateGenericGameSelection(
  gameKey: EuroGenericGameKey,
  selection?: string | null
) {
  if (gameKey === "ludo" && !/^[1-6]$/.test(selection ?? ""))
    return "Please choose a number from 1 to 6.";
  if (gameKey === "color" && selection !== "red" && selection !== "green")
    return "Please choose Red or Green.";
  if (gameKey === "lucky" && !/^\d$/.test(selection ?? ""))
    return "Please choose a lucky number from 0 to 9.";
  return null;
}

export function maxDailyGameProfit(packagePricePkr: number | null | undefined) {
  return Math.max(0, packagePricePkr ?? 0) * 3;
}

export function cappedAviatorPayout(input: {
  stakePkr: number;
  multiplierX100: number;
  priorProfitPkr: number;
  dailyProfitLimitPkr: number;
}) {
  const requested = Math.floor((input.stakePkr * input.multiplierX100) / 100);
  const requestedProfit = Math.max(0, requested - input.stakePkr);
  const availableProfit = Math.max(0, input.dailyProfitLimitPkr - input.priorProfitPkr);
  const payout = input.stakePkr + Math.min(requestedProfit, availableProfit);
  return { payoutPkr: payout, profitPkr: Math.max(0, payout - input.stakePkr) };
}
