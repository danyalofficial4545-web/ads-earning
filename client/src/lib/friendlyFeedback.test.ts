import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("friendly member feedback", () => {
  it("uses a large solid-black top-center notification treatment for all toasts", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const sonner = readFileSync(
      new URL("../components/ui/sonner.tsx", import.meta.url),
      "utf8"
    );

    expect(app).toContain('<Toaster position="top-center" duration={4000} />');
    expect(sonner).toContain('position="top-center"');
    expect(sonner).toContain('duration={4000}');
    expect(sonner).toContain('!bg-black');
    expect(sonner).toContain('!text-white');
  });

  it("connects member forms to safe inline validation and proof-number matching", () => {
    const auth = readFileSync(
      new URL("../components/PublicAuth.tsx", import.meta.url),
      "utf8"
    );
    const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");

    expect(auth).toContain("validateEmail(signIn.email)");
    expect(auth).toContain("validatePassword(signUp.password)");
    expect(auth).not.toContain("toast.error(error.message)");
    expect(home).toContain("validateDepositAmount(amount, currency)");
    expect(home).toContain("validateWithdrawalAmount(amount, currency)");
    expect(home).toContain("readPaymentProofNumbers(file)");
    expect(home).toContain("proofContainsAccountNumber(proofNumbers, senderAccountNumber)");
    expect(home).not.toContain("if (session.error) return <LoadingScreen text={session.error.message}");
  });

  it("does not render an exception stack in the app fallback", () => {
    const boundary = readFileSync(
      new URL("../components/ErrorBoundary.tsx", import.meta.url),
      "utf8"
    );
    expect(boundary).not.toContain("error?.stack");
  });
});
