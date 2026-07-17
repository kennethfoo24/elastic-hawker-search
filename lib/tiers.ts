import type { TierKey } from "./types";

export interface TierMeta {
  key: TierKey;
  name: string;
  how: string;
}

export const TIERS: TierMeta[] = [
  {
    key: "keyword",
    name: "Keyword",
    how: "Literal keyword overlap. Exact matches only.",
  },
  {
    key: "semantic",
    name: "Semantic",
    how: "Ranks by meaning. Cross-lingual dense vectors.",
  },
  {
    key: "hybrid",
    name: "Hybrid (Keyword + Semantic + RRF)",
    how: "Both engines, fused by rank (RRF) — best of each.",
  },
];
