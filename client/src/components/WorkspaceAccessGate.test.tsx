import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceAccessGate } from "./WorkspaceAccessGate";

const renderGate = (hasPassword: boolean | undefined, username: string) => renderToStaticMarkup(<WorkspaceAccessGate hasPassword={hasPassword} username={username} onboarding={<p>Google setup</p>} profileSetup={<p>Profile setup</p>} workspace={<p>Member workspace</p>} />);

describe("WorkspaceAccessGate", () => {
  it("renders combined Google setup before any member workspace for a new Google account", () => {
    expect(renderGate(false, "member42")).toContain("Google setup");
    expect(renderGate(false, "member42")).not.toContain("Member workspace");
  });

  it("preserves password-member and administrator workspace access", () => {
    expect(renderGate(true, "existing_member")).toContain("Member workspace");
    expect(renderGate(true, "danyal955163")).toContain("Member workspace");
  });
});
