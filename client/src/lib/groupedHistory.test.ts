import { describe, expect, it } from "vitest";
import { groupHistoryRows, historyDateLabel } from "./groupedHistory";

describe("member financial history grouping", () => {
  it("groups same-day records and distinguishes today, yesterday, and earlier dates", () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const groups = groupHistoryRows([
      { id: 1, createdAt: new Date(2026, 7, 17, 10, 0, 0) },
      { id: 2, createdAt: new Date(2026, 7, 17, 8, 0, 0) },
      { id: 3, createdAt: new Date(2026, 7, 16, 18, 0, 0) },
      { id: 4, createdAt: new Date(2026, 7, 10, 18, 0, 0) },
    ]);
    expect(groups.map(group => group.items.length)).toEqual([2, 1, 1]);
    expect(historyDateLabel(groups[0].key, now)).toBe("today");
    expect(historyDateLabel(groups[1].key, now)).toBe("yesterday");
    expect(historyDateLabel(groups[2].key, now)).toBe("date");
  });
});
