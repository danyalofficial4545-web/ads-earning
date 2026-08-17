import { describe, expect, it } from "vitest";
import { buildInviteSummary } from "./inviteSummary";

describe("Invite page summary", () => {
  it("maps referral link, code, total invites, and referral earnings from the member referral payload", () => {
    expect(buildInviteSummary({ username: "ali khan", referralCode: "PEPALI", totalReferrals: 4, withdrawalLimitPkr: 500 }, "https://packearnpro-2es9vxie.manus.space")).toEqual({
      link: "https://packearnpro-2es9vxie.manus.space/?ref=ali%20khan",
      referralCode: "PEPALI",
      totalInvites: 4,
      referralEarningsPkr: 500,
    });
  });
});
