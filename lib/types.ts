export type TierKey = "keyword" | "semantic" | "combined" | "hybrid";

export interface GeoPoint {
  lat: number;
  lon: number;
}

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
  image_url?: string;
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
  image_url: string | null;
  location: GeoPoint | null;
  /** distance in km from the active area preset's center, only set when an area filter is applied */
  distanceKm: number | null;
  /** constituent ranks in the standalone keyword/semantic tiers (combined + hybrid tiers only) */
  legRanks?: { keyword: number | null; semantic: number | null };
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
  area: string | null;
  tiers: Record<TierKey, TierResult>;
}
