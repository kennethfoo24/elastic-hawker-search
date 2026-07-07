export type SemModel = "elser" | "e5";

export type TierKey = "lexical" | "semantic" | "naiveHybrid" | "rrf";

export interface Dish {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  stall: string;
  region: string;
  cuisine: string;
  price_sgd: number;
  tags: string[];
}

export interface Hit {
  id: string;
  rank: number;
  score: number | null;
  name: string;
  stall: string;
  region: string;
  cuisine: string;
  price_sgd: number;
  tags: string[];
  snippet: string;
  /** which bool/should legs matched (naive hybrid tier only) */
  matchedLegs?: string[];
  /** constituent ranks in the standalone lexical/semantic tiers (rrf tier only) */
  legRanks?: { lexical: number | null; semantic: number | null };
}

export interface TierResult {
  key: TierKey;
  tookMs: number;
  esTookMs: number | null;
  totalHits: number;
  hits: Hit[];
  error?: string;
}

export interface SearchResponse {
  query: string;
  model: SemModel;
  tiers: Record<TierKey, TierResult>;
}
