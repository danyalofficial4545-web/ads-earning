import { createHmac, randomInt } from "node:crypto";

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
    let multiplierX100 = 0;
    let reels = ["💎", "K", "J", "🔷", "♦️", "💚", "🔴", "K", "J"];
    if (randomPercent < 30) multiplierX100 = 0;
    else if (randomPercent < 90) {
      multiplierX100 = 150 + randomInteger(151);
      reels = ["💎", "K", "🔷", "💎", "💎", "💎", "♦️", "J", "💚"];
    } else if (randomPercent < 97) {
      multiplierX100 = 500 + randomInteger(501);
      reels = ["🔷", "K", "💚", "🔷", "🔷", "🔷", "♦️", "J", "💎"];
    } else {
      multiplierX100 = 1_500 + randomInteger(3_501);
      reels = Array(9).fill("💎");
    }
    return { multiplierX100, publicState: { reels } };
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

export const SHARED_CRASH_ROUND_MS = 15_000;
export const SHARED_CRASH_BETTING_MS = 5_000;
export const SHARED_COLOR_ROUND_MS = 15_000;
export const SHARED_COLOR_BETTING_MS = 10_000;
export const SHARED_LUCKY_ROUND_MS = 20_000;
export const SHARED_LUCKY_BETTING_MS = 15_000;
const SHARED_CRASH_GROWTH_MS = 1_800;

export type SharedGameKey = "aviator" | "crash" | "color" | "lucky";

function seededBytes(input: string) {
  return createHmac("sha256", process.env.JWT_SECRET ?? "euro-shared-round-secret")
    .update(input)
    .digest();
}

function seedPercent(input: string, offset = 0) {
  return seededBytes(input)[offset % 32]! % 100;
}

function seedRange(input: string, min: number, max: number, offset = 1) {
  const bytes = seededBytes(input);
  const value = ((bytes[offset % 32]! << 8) | bytes[(offset + 1) % 32]!) >>> 0;
  return min + (value % (max - min + 1));
}

export function sharedRoundKey(gameKey: SharedGameKey, now = new Date()) {
  const period =
    gameKey === "color"
      ? SHARED_COLOR_ROUND_MS
      : gameKey === "lucky"
        ? SHARED_LUCKY_ROUND_MS
        : SHARED_CRASH_ROUND_MS;
  return `${gameKey}:${Math.floor(now.getTime() / period)}`;
}

export function sharedRoundTiming(gameKey: SharedGameKey, now = new Date()) {
  const period =
    gameKey === "color"
      ? SHARED_COLOR_ROUND_MS
      : gameKey === "lucky"
        ? SHARED_LUCKY_ROUND_MS
        : SHARED_CRASH_ROUND_MS;
  const bettingMs =
    gameKey === "color"
      ? SHARED_COLOR_BETTING_MS
      : gameKey === "lucky"
        ? SHARED_LUCKY_BETTING_MS
        : SHARED_CRASH_BETTING_MS;
  const startsAtMs = Math.floor(now.getTime() / period) * period;
  const elapsedMs = now.getTime() - startsAtMs;
  return {
    roundKey: `${gameKey}:${Math.floor(now.getTime() / period)}`,
    startsAt: new Date(startsAtMs),
    endsAt: new Date(startsAtMs + period),
    elapsedMs,
    bettingMs,
    periodMs: period,
  };
}

export function parseSharedCrashWeights(raw?: string | null) {
  const parsed = (raw ?? "")
    .split(",")
    .map(value => Number(value.trim()))
    .filter(Number.isFinite);
  if (
    parsed.length === 4 &&
    parsed.every(weight => Number.isInteger(weight) && weight >= 0) &&
    parsed.reduce((total, weight) => total + weight, 0) === 100
  )
    return parsed;
  return [70, 10, 10, 10] as const;
}

export function sharedCrashMultiplierX100(roundKey: string, rawWeights?: string | null) {
  const [low, broad, medium] = parseSharedCrashWeights(rawWeights);
  const roll = seedPercent(`crash:band:${roundKey}`);
  if (roll < low) return seedRange(`crash:low:${roundKey}`, 101, 150);
  if (roll < low + broad) return seedRange(`crash:broad:${roundKey}`, 100, 500);
  if (roll < low + broad + medium) return seedRange(`crash:medium:${roundKey}`, 501, 1_500);
  const candidate = seedRange(`crash:high:${roundKey}`, 5_000, 20_000);
  const [, indexText] = roundKey.split(":");
  const previousIndex = Math.max(0, Number(indexText ?? 0) - 1);
  const previousKey = `${roundKey.split(":")[0]}:${previousIndex}`;
  const previous = seedRange(`crash:high:${previousKey}`, 5_000, 20_000);
  return candidate === previous ? Math.min(20_000, candidate + 1) : candidate;
}

export function sharedCrashState(gameKey: "aviator" | "crash", now = new Date(), rawWeights?: string | null) {
  const timing = sharedRoundTiming(gameKey, now);
  const crashMultiplierX100 = sharedCrashMultiplierX100(timing.roundKey, rawWeights);
  const flightElapsedMs = Math.max(0, timing.elapsedMs - timing.bettingMs);
  const multiplierX100 = Math.max(100, Math.floor(Math.exp(flightElapsedMs / SHARED_CRASH_GROWTH_MS) * 100));
  const crashElapsedMs = Math.ceil(Math.log(Math.max(1, crashMultiplierX100 / 100)) * SHARED_CRASH_GROWTH_MS);
  const crashed = timing.elapsedMs >= timing.bettingMs + crashElapsedMs;
  return {
    ...timing,
    phase: timing.elapsedMs < timing.bettingMs ? "betting" : crashed ? "crashed" : "flying",
    crashMultiplierX100,
    multiplierX100: Math.min(crashMultiplierX100, multiplierX100),
    crashAt: new Date(timing.startsAt.getTime() + timing.bettingMs + crashElapsedMs),
  } as const;
}

export function sharedColorState(now = new Date()) {
  const timing = sharedRoundTiming("color", now);
  const value = seedPercent(`color:${timing.roundKey}`);
  const result = value < 48 ? "red" : value < 96 ? "green" : "tie";
  return { ...timing, phase: timing.elapsedMs < timing.bettingMs ? "betting" : "result", result } as const;
}

export function sharedLuckyState(now = new Date()) {
  const timing = sharedRoundTiming("lucky", now);
  const result = seedRange(`lucky:${timing.roundKey}`, 0, 9);
  return { ...timing, phase: timing.elapsedMs < timing.bettingMs ? "betting" : "result", result } as const;
}

export type LudoBoardState = {
  rolls: number[];
  playerOneTokens: number[];
  playerTwoTokens: number[];
  turn: "one" | "two";
  turnNumber: number;
};

export function createLudoBoardState(): LudoBoardState {
  return { rolls: [], playerOneTokens: [-1, -1, -1, -1], playerTwoTokens: [-1, -1, -1, -1], turn: "one", turnNumber: 0 };
}

export function ludoRollFor(matchId: string, turnNumber: number) {
  return seedRange(`ludo:${matchId}:${turnNumber}`, 1, 6);
}

export function moveLudoToken(input: {
  board: LudoBoardState;
  side: "one" | "two";
  tokenIndex: number;
  roll: number;
}) {
  const own = input.side === "one" ? [...input.board.playerOneTokens] : [...input.board.playerTwoTokens];
  const opponent = input.side === "one" ? [...input.board.playerTwoTokens] : [...input.board.playerOneTokens];
  const current = own[input.tokenIndex] ?? -1;
  if (current < 0 && input.roll !== 6) return { board: input.board, moved: false, winner: false };
  const next = current < 0 ? 0 : Math.min(57, current + input.roll);
  own[input.tokenIndex] = next;
  if (next >= 0 && next < 52) {
    opponent.forEach((position, index) => {
      if (position === next && ![0, 8, 13, 21, 26, 34, 39, 47].includes(next)) opponent[index] = -1;
    });
  }
  const winner = own.every(position => position >= 57);
  const board: LudoBoardState = {
    ...input.board,
    ...(input.side === "one" ? { playerOneTokens: own, playerTwoTokens: opponent } : { playerOneTokens: opponent, playerTwoTokens: own }),
    turn: input.roll === 6 ? input.side : input.side === "one" ? "two" : "one",
    turnNumber: input.board.turnNumber + 1,
    rolls: [...input.board.rolls.slice(-9), input.roll],
  };
  return { board, moved: true, winner };
}
