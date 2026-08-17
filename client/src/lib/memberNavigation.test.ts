import { describe, expect, it } from "vitest";
import { isMemberBottomNavigationId, memberBottomNavigationIds } from "./memberNavigation";

describe("member bottom navigation", () => {
  it("keeps Profile and Invite while excluding standalone Deposit and Withdrawal pages", () => {
    expect(memberBottomNavigationIds).toEqual(["dashboard", "packages", "profile", "invite"]);
    expect(isMemberBottomNavigationId("deposit")).toBe(false);
    expect(isMemberBottomNavigationId("withdrawal")).toBe(false);
  });
});
