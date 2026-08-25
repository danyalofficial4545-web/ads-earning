export const memberBottomNavigationIds = [
  "dashboard",
  "packages",
  "profile",
  "invite",
  "euro",
] as const;

export function isMemberBottomNavigationId(id: string) {
  return memberBottomNavigationIds.includes(
    id as (typeof memberBottomNavigationIds)[number]
  );
}
