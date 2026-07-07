import type { SemModel } from "./types";

/**
 * The four query builders — the heart of the demo.
 * All use the retriever framework so the tiers differ ONLY in retrieval strategy.
 * `match` on a semantic_text field is the documented recommended semantic query.
 */

export const SEM_FIELD: Record<SemModel, "semantic_elser" | "semantic_e5"> = {
  elser: "semantic_elser",
  e5: "semantic_e5",
};

const LEXICAL_FIELDS = ["name^3", "aliases^2", "description", "stall", "tags"];

const SIZE = 10;

function lexicalLeg(q: string, name?: string) {
  return {
    multi_match: {
      query: q,
      fields: LEXICAL_FIELDS,
      ...(name ? { _name: name } : {}),
    },
  };
}

function semanticLeg(q: string, semField: string, name?: string) {
  return {
    match: {
      [semField]: { query: q, ...(name ? { _name: name } : {}) },
    },
  };
}

/** Tier 1 — pure BM25 keyword matching. */
export function buildLexical(q: string) {
  return {
    retriever: { standard: { query: lexicalLeg(q) } },
    size: SIZE,
    _source: { excludes: ["semantic_elser", "semantic_e5"] },
    highlight: { fields: { description: {} } },
  };
}

/** Tier 2 — pure semantic retrieval against the selected model's semantic_text field. */
export function buildSemantic(q: string, model: SemModel) {
  const semField = SEM_FIELD[model];
  return {
    retriever: { standard: { query: semanticLeg(q, semField) } },
    size: SIZE,
    _source: { excludes: ["semantic_elser", "semantic_e5"] },
    highlight: {
      fields: {
        [semField]: { type: "semantic", number_of_fragments: 1, order: "score" },
      },
    },
  };
}

/**
 * Tier 3 — naive hybrid (deliberate anti-pattern): bool/should adds raw BM25 and
 * semantic scores despite incompatible scales (ELSER ~10–20 swamps BM25; e5 ~1 gets
 * swamped). `_name` lets the UI badge which leg(s) actually matched each hit.
 */
export function buildNaiveHybrid(q: string, model: SemModel) {
  const semField = SEM_FIELD[model];
  return {
    retriever: {
      standard: {
        query: {
          bool: {
            should: [lexicalLeg(q, "lexical_leg"), semanticLeg(q, semField, "semantic_leg")],
          },
        },
      },
    },
    size: SIZE,
    _source: { excludes: ["semantic_elser", "semantic_e5"] },
  };
}

/**
 * Tier 4 — hybrid via reciprocal rank fusion: same two legs, fused by rank
 * (score = Σ 1/(rank + 60)), immune to score-scale mismatch.
 */
export function buildRrf(q: string, model: SemModel) {
  const semField = SEM_FIELD[model];
  return {
    retriever: {
      rrf: {
        retrievers: [
          { standard: { query: lexicalLeg(q) } },
          { standard: { query: semanticLeg(q, semField) } },
        ],
        rank_constant: 60,
        rank_window_size: 50,
      },
    },
    size: SIZE,
    _source: { excludes: ["semantic_elser", "semantic_e5"] },
    highlight: {
      fields: {
        [semField]: { type: "semantic", number_of_fragments: 1, order: "score" },
      },
    },
  };
}
