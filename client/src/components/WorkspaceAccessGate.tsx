import { resolveWorkspaceGate } from "@/lib/authOnboarding";
import React from "react";
import type { ReactNode } from "react";

export function WorkspaceAccessGate({ hasPassword, username, onboarding, profileSetup, workspace }: { hasPassword: boolean | undefined; username: string; onboarding: ReactNode; profileSetup: ReactNode; workspace: ReactNode }) {
  const gate = resolveWorkspaceGate(hasPassword, username);
  if (gate === "google-onboarding") return <>{onboarding}</>;
  if (gate === "profile-setup") return <>{profileSetup}</>;
  return <>{workspace}</>;
}
