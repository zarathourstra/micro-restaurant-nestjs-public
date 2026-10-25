export interface RewardTier {
  minScore: number;
  discountPercent: number;
  lineCount: number;
}

export const REWARD_TIERS: readonly RewardTier[] = [
  { minScore: 24, discountPercent: 15, lineCount: 3 },
  { minScore: 18, discountPercent: 10, lineCount: 2 },
  { minScore: 12, discountPercent: 5, lineCount: 1 },
];

export function rewardForScore(score: number): RewardTier | null {
  return REWARD_TIERS.find((tier) => score >= tier.minScore) ?? null;
}
