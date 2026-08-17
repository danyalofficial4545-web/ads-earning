export function shouldAutoClaimAd(input: {
  hasSession: boolean;
  secondsRemaining: number;
  autoClaimAttempted: boolean;
  claimPending: boolean;
}) {
  return (
    input.hasSession &&
    input.secondsRemaining === 0 &&
    !input.autoClaimAttempted &&
    !input.claimPending
  );
}
