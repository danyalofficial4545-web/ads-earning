export const dashboardMetricKeys = [
  "balance",
  "totalEarned",
  "totalWithdrawals",
  "totalDeposits",
  "adsToday",
  "totalAdsWatched",
] as const;

export type DashboardMetricKey = (typeof dashboardMetricKeys)[number];
