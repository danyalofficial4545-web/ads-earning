export type DatedHistoryRow = { createdAt: Date | string };

export function historyDateKey(value: Date | string) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function groupHistoryRows<T extends DatedHistoryRow>(rows: T[]) {
  const groups = new Map<string, T[]>();
  rows.forEach(row => {
    const key = historyDateKey(row.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return Array.from(groups, ([key, items]) => ({ key, items }));
}

export function historyDateLabel(key: string, now = new Date()) {
  const today = historyDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === today) return "today" as const;
  if (key === historyDateKey(yesterday)) return "yesterday" as const;
  return "date" as const;
}
