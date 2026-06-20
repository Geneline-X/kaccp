export type TriageInput = {
  asrConfidence?: number | null;
  outcome: string | null;
  amount?: number;
};

export type TriageResult = {
  tier: 1 | 2 | 3 | 4;
  reason: string;
  shouldReview: boolean;
};

const TIER_1_AMOUNT_THRESHOLD = 100;

export function triageSession(input: TriageInput): TriageResult {
  const { outcome, amount } = input;
  const isLowConfidence = input.asrConfidence != null && input.asrConfidence < 0.6;
  const isMediumConfidence = input.asrConfidence != null && input.asrConfidence < 0.8;
  const isFailed = outcome === "abandoned" || outcome === "agent_escalation";
  const isRetry = outcome === "retry";
  const isHighAmount = (amount ?? 0) >= TIER_1_AMOUNT_THRESHOLD;

  // Tier 1 — outcome + amount driven, confidence is bonus
  if (isFailed && isHighAmount) {
    return {
      tier: 1,
      reason: "Failed transaction, high amount — critical review",
      shouldReview: true,
    };
  }

  // Tier 2 — user signaled something went wrong
  if (isFailed || isRetry) {
    const signal = isFailed ? "failed transaction" : "user retried";
    if (isLowConfidence) {
      return {
        tier: 2,
        reason: `${signal} + low ASR confidence`,
        shouldReview: true,
      };
    }
    return {
      tier: 2,
      reason: signal,
      shouldReview: true,
    };
  }

  // Tier 2 — low confidence even on success (model clearly struggled)
  if (isLowConfidence) {
    return {
      tier: 2,
      reason: "Low ASR confidence despite success",
      shouldReview: true,
    };
  }

  // Tier 2 — medium confidence + any negative signal
  if (isMediumConfidence && (isFailed || isRetry)) {
    return {
      tier: 2,
      reason: "Medium confidence with negative outcome signal",
      shouldReview: true,
    };
  }

  // Tier 3 — everything else, sample rate
  return {
    tier: 3,
    reason: "High confidence, successful — sample rate review",
    shouldReview: false,
  };
}
