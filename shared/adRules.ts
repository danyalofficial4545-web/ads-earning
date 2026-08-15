const PAKISTAN_TIME_ZONE = "Asia/Karachi";
const PAKISTAN_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

function pakistanDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PAKISTAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (name: string) =>
    Number(parts.find(part => part.type === name)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function getPakistanDayKey(date = new Date()) {
  const { year, month, day } = pakistanDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getNextPakistanMidnight(date = new Date()) {
  const { year, month, day } = pakistanDateParts(date);
  return new Date(Date.UTC(year, month - 1, day + 1) - PAKISTAN_UTC_OFFSET_MS);
}

export function getPakistanResetSeconds(date = new Date()) {
  return Math.max(
    0,
    Math.ceil((getNextPakistanMidnight(date).getTime() - date.getTime()) / 1000)
  );
}

export function getDailyAdQuota(packagePricePkr: number) {
  return Math.max(0, Math.floor(packagePricePkr / 100));
}

export function getDailyAdStates(
  adIds: number[],
  quota: number,
  watchedAdIds: Set<number>
) {
  return adIds.map((id, index) => ({
    id,
    state: watchedAdIds.has(id)
      ? ("watched" as const)
      : index < quota
        ? ("unlocked" as const)
        : ("locked" as const),
  }));
}
