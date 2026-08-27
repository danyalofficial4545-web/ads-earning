import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("attached signup validation requirements", () => {
  it("puts a password mismatch message under Confirm Password and does not show generic registration-error toasts", () => {
    const source = readFileSync(new URL("./PublicAuth.tsx", import.meta.url), "utf8");
    expect(source).toContain("validatePasswordConfirmation(");
    expect(source).toContain("<FieldError>{signUpErrors.confirmPassword}</FieldError>");
    expect(source).not.toContain('toast.error(friendlyMessages.requestFailed);');
  });

  it("uses the custom validation path instead of browser highlighted-field blocking", () => {
    const source = readFileSync(new URL("./PublicAuth.tsx", import.meta.url), "utf8");
    expect(source).toContain('<form noValidate className="mt-6 space-y-4" onSubmit={submitSignIn}>');
    expect(source).toContain('<form noValidate className="mt-6 space-y-4" onSubmit={submitSignUp}>');
    expect(source).not.toContain("<input required");
  });
});
