import type { AreaPreset } from "./geo";
import type { TierKey } from "./types";

/**
 * The three query builders — the heart of the demo. They form an additive
 * progression: Keyword -> Semantic -> Hybrid (Keyword + Semantic + RRF).
 * Semantic search always uses multilingual-e5 (`semantic_e5`) — `match` on a
 * semantic_text field is the documented recommended semantic query.
 */

const LEXICAL_FIELDS = ["name^3", "aliases^2", "description", "stall", "tags"];

const SIZE = 5;

/**
 * The keyword leg used everywhere (column 1, and as the keyword leg inside
 * Hybrid) — `minimum_should_match: "75%"` so a query with no real
 * lexical overlap returns genuinely nothing, instead of a long tail of
 * single-token matches. This is also what makes the KEY attribution shown on
 * the Hybrid cards honest: it's the exact query column 1 runs.
 */
function keywordQuery(q: string) {
  return {
    multi_match: {
      query: q,
      fields: LEXICAL_FIELDS,
      minimum_should_match: "75%",
    },
  };
}

function semanticQuery(q: string) {
  return { match: { semantic_e5: { query: q } } };
}

/** Wrap a query in a geo_distance filter when an area preset is active — same candidate pool for every column. */
function withGeo(query: object, area?: AreaPreset | null) {
  if (!area) return query;
  return {
    bool: {
      must: query,
      filter: {
        geo_distance: {
          distance: `${area.radiusKm}km`,
          location: { lat: area.lat, lon: area.lon },
        },
      },
    },
  };
}

const SOURCE_EXCLUDES = { excludes: ["semantic_e5"] };

/** Column 1 — Keyword: pure BM25 matching. Wins on exact names; genuinely empty when nothing lexically overlaps. */
export function buildKeyword(q: string, area?: AreaPreset | null) {
  return {
    retriever: { standard: { query: withGeo(keywordQuery(q), area) } },
    size: SIZE,
    _source: SOURCE_EXCLUDES,
    highlight: { fields: { description: {} } },
  };
}

/** Column 2 — Semantic: multilingual-e5 dense retrieval. Cross-lingual; reads intent, not literal words. */
export function buildSemantic(q: string, area?: AreaPreset | null) {
  return {
    retriever: { standard: { query: withGeo(semanticQuery(q), area) } },
    size: SIZE,
    _source: SOURCE_EXCLUDES,
    highlight: {
      fields: { semantic_e5: { type: "semantic", number_of_fragments: 1, order: "score" } },
    },
  };
}

/**
 * Column 3 — Hybrid (Keyword + Semantic + RRF): reciprocal rank fusion of the
 * two legs above, by rank instead of raw score — immune to the BM25/cosine
 * scale mismatch that breaks naive score addition. `rank_constant: 60` is the
 * documented default; `rank_window_size: 50` (default 10 is too shallow).
 * (An earlier version of this demo had a 4th "naive score addition" column
 * demonstrating that anti-pattern live — see git history if reviving it.)
 */
export function buildHybrid(q: string, area?: AreaPreset | null) {
  return {
    retriever: {
      rrf: {
        retrievers: [
          { standard: { query: withGeo(keywordQuery(q), area) } },
          { standard: { query: withGeo(semanticQuery(q), area) } },
        ],
        rank_constant: 60,
        rank_window_size: 50,
      },
    },
    size: SIZE,
    _source: SOURCE_EXCLUDES,
    highlight: {
      fields: { semantic_e5: { type: "semantic", number_of_fragments: 1, order: "score" } },
    },
  };
}

/** Single dispatch point from a column key to its query builder — shared by the API route and validate-chips.ts. */
export function buildQuery(tier: TierKey, q: string, area?: AreaPreset | null): object {
  switch (tier) {
    case "keyword":
      return buildKeyword(q, area);
    case "semantic":
      return buildSemantic(q, area);
    case "hybrid":
      return buildHybrid(q, area);
  }
}
