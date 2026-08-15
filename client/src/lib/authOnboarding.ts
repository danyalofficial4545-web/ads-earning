export function requiresGoogleOnboarding(hasPassword: boolean | undefined) {
  return !hasPassword;
}

export type WorkspaceGate = "google-onboarding" | "profile-setup" | "workspace";

export function resolveWorkspaceGate(hasPassword: boolean | undefined, username: string): WorkspaceGate {
  if (requiresGoogleOnboarding(hasPassword)) return "google-onboarding";
  return username.startsWith("member") ? "profile-setup" : "workspace";
}
