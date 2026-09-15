export const DEPOSITOR_BONUS_RATE = 0.10;
export const INVITER_REWARD_RATE = 0.40;

export function calculateDepositorBonus(amountPkr: number) {
  return Math.floor(amountPkr * DEPOSITOR_BONUS_RATE);
}

export function calculateInviterReward(amountPkr: number) {
  return Math.floor(amountPkr * INVITER_REWARD_RATE);
}
