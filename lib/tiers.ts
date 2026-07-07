import type { SemModel, TierKey } from "./types";

export interface TierMeta {
  key: TierKey;
  name: string;
  tech: (model: SemModel) => string;
  how: (model: SemModel) => string;
  /** literal Tailwind classes so the compiler picks them up */
  barClass: string;
  textClass: string;
  cssColor: string;
}

export const MODEL_LABEL: Record<SemModel, string> = {
  elser: "ELSER (sparse)",
  e5: "multilingual-e5 (dense)",
};

export const TIERS: TierMeta[] = [
  {
    key: "lexical",
    name: "Lexical",
    tech: () => "BM25 multi_match",
    how: () => "Ranks by literal keyword overlap. Great for exact names; blind to meaning.",
    barClass: "bg-lexical",
    textClass: "text-lexical",
    cssColor: "var(--color-lexical)",
  },
  {
    key: "semantic",
    name: "Semantic",
    tech: (m) => MODEL_LABEL[m],
    how: (m) =>
      m === "elser"
        ? "Ranks by meaning via sparse term expansion. English-only."
        : "Ranks by meaning via dense vectors. Cross-lingual.",
    barClass: "bg-semantic",
    textClass: "text-semantic",
    cssColor: "var(--color-semantic)",
  },
  {
    key: "naiveHybrid",
    name: "Hybrid · naive",
    tech: () => "bool should — raw score add",
    how: () => "Adds BM25 + semantic scores directly. Incompatible scales — one leg swamps the other.",
    barClass: "bg-naive",
    textClass: "text-naive",
    cssColor: "var(--color-naive)",
  },
  {
    key: "rrf",
    name: "Hybrid · RRF",
    tech: () => "rrf retriever — Σ 1/(rank+60)",
    how: () => "Fuses both legs by rank, not score. Rewards agreement; immune to scale mismatch.",
    barClass: "bg-rrf",
    textClass: "text-rrf",
    cssColor: "var(--color-rrf)",
  },
];
