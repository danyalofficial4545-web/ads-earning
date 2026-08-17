export function buildInviteSummary(
  referral: {
    username: string;
    referralCode: string;
    totalReferrals: number;
    withdrawalLimitPkr: number;
  },
  origin: string
) {
  return {
    link: `${origin}/?ref=${encodeURIComponent(referral.username)}`,
    referralCode: referral.referralCode,
    totalInvites: referral.totalReferrals,
    referralEarningsPkr: referral.withdrawalLimitPkr,
  };
}
