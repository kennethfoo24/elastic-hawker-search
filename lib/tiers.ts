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
    key: "combined",
    name: "Keyword + Semantic",
    how: "Adds BM25 + cosine scores directly — BM25 usually dominates.",
  },
  {
    key: "hybrid",
    name: "Keyword + Semantic + Rank",
    how: "Fuses by rank, not score — fixes the scale mismatch.",
  },
];
