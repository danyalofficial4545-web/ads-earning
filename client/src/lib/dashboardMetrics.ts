export const dashboardMetricKeys = [
  "balance",
  "adsToday",
  "totalEarned",
] as const;

export type DashboardMetricKey = (typeof dashboardMetricKeys)[number];
