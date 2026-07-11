import { prisma } from "@/lib/db";
import {
  DEFAULT_DORMANT_CONFIG,
  type DormantConfig,
} from "@/server/services/ranking/scoring";

export interface RankingConfig {
  minVotes: number;
  minLikes: number;
  targetVotes: number;
}

export interface AppConfigs {
  dormant: DormantConfig;
  ranking: RankingConfig;
}

const DEFAULT_RANKING_CONFIG: RankingConfig = {
  minVotes: 20,
  minLikes: 5,
  targetVotes: 100,
};

let cache: AppConfigs | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

export async function getAppConfigs(): Promise<AppConfigs> {
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const rows = await prisma.appConfig.findMany();
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    cache = {
      dormant: {
        ...DEFAULT_DORMANT_CONFIG,
        ...((map.dormant as Partial<DormantConfig> | undefined) ?? {}),
      },
      ranking: {
        ...DEFAULT_RANKING_CONFIG,
        ...((map.ranking as Partial<RankingConfig> | undefined) ?? {}),
      },
    };
  } catch {
    cache = {
      dormant: DEFAULT_DORMANT_CONFIG,
      ranking: DEFAULT_RANKING_CONFIG,
    };
  }

  cacheTime = Date.now();
  return cache;
}

export function clearAppConfigCache() {
  cache = null;
  cacheTime = 0;
}
