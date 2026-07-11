const Z = 1.96;

export function wilsonLowerBound(likeCount: number, passCount: number): number {
  const n = likeCount + passCount;
  if (n === 0) return 0;

  const p = likeCount / n;
  const z2 = Z * Z;
  const numerator =
    p + z2 / (2 * n) - Z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  const denominator = 1 + z2 / n;
  return Math.max(0, numerator / denominator);
}

export function wilsonUpperBound(likeCount: number, passCount: number): number {
  const n = likeCount + passCount;
  if (n === 0) return 1;

  const p = likeCount / n;
  const z2 = Z * Z;
  const numerator =
    p + z2 / (2 * n) + Z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  const denominator = 1 + z2 / n;
  return Math.min(1, numerator / denominator);
}

export function computeLikeRate(likeCount: number, passCount: number): number {
  const total = likeCount + passCount;
  return total === 0 ? 0 : likeCount / total;
}

export function volumeFactor(totalVotes: number, targetVotes = 100): number {
  return Math.min(1.0, Math.log10(totalVotes + 1) / Math.log10(targetVotes + 1));
}

export function freshnessFactor(ageHours: number, halfLifeHours: number): number {
  return Math.exp(-ageHours / halfLifeHours);
}

export interface RankingScoreInput {
  likeCount: number;
  passCount: number;
  publishedAt?: Date | null;
  period?: "ALL_TIME" | "DAILY" | "WEEKLY" | "MONTHLY";
  moderationFactor?: number;
  targetVotes?: number;
}

export function computeRankingScore(input: RankingScoreInput): number {
  const {
    likeCount,
    passCount,
    publishedAt,
    period = "ALL_TIME",
    moderationFactor = 1.0,
    targetVotes = 100,
  } = input;

  const confidence = wilsonLowerBound(likeCount, passCount);
  const totalVotes = likeCount + passCount;
  const volume = volumeFactor(totalVotes, targetVotes);

  let freshness = 1.0;
  if (period !== "ALL_TIME" && publishedAt) {
    const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
    const halfLives: Record<string, number> = {
      DAILY: 24,
      WEEKLY: 24 * 7,
      MONTHLY: 24 * 30,
    };
    freshness = freshnessFactor(ageHours, halfLives[period] ?? 24);
  }

  return confidence * (0.7 + 0.3 * volume) * freshness * moderationFactor;
}

export interface DormantConfig {
  earlyStopMinVotes: number;
  earlyStopMaxLikeRate: number;
  standardStopMinVotes: number;
  standardStopMaxLikeRate: number;
  wilsonStopMinVotes: number;
  wilsonStopUpperBound: number;
}

export const DEFAULT_DORMANT_CONFIG: DormantConfig = {
  earlyStopMinVotes: 20,
  earlyStopMaxLikeRate: 0.15,
  standardStopMinVotes: 50,
  standardStopMaxLikeRate: 0.25,
  wilsonStopMinVotes: 30,
  wilsonStopUpperBound: 0.35,
};

export function shouldBecomeDormant(
  likeCount: number,
  passCount: number,
  config: DormantConfig = DEFAULT_DORMANT_CONFIG
): boolean {
  const total = likeCount + passCount;
  const likeRate = computeLikeRate(likeCount, passCount);

  if (total >= config.earlyStopMinVotes && likeRate <= config.earlyStopMaxLikeRate) {
    return true;
  }

  if (total >= config.standardStopMinVotes && likeRate <= config.standardStopMaxLikeRate) {
    return true;
  }

  if (
    total >= config.wilsonStopMinVotes &&
    wilsonUpperBound(likeCount, passCount) < config.wilsonStopUpperBound
  ) {
    return true;
  }

  return false;
}

export function meetsRankingEligibility(
  likeCount: number,
  passCount: number,
  minVotes = 20,
  minLikes = 5
): boolean {
  const total = likeCount + passCount;
  return total >= minVotes && likeCount >= minLikes;
}
