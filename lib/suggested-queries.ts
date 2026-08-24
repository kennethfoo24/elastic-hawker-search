export interface SuggestedQuery {
  query: string;
  label: string;
  archetype: string;
  observe: string;
  /** preset area key (see lib/geo.ts AREA_PRESETS) to apply when this chip is picked */
  area?: string;
}

export const SUGGESTED_QUERIES: SuggestedQuery[] = [
  {
    query: "Hainanese chicken rice",
    label: "Hainanese chicken rice",
    archetype: "exact term",
    observe:
      "All three columns agree — when keywords match, Keyword alone is enough. Semantic and Hybrid add nothing here, and cost more to run.",
  },
  {
    query: "spicy coconut milk noodle soup",
    label: "spicy coconut milk noodle soup",
    archetype: "paraphrase",
    observe:
      "Keyword barely finds anything and ranks Nasi Lemak over Katong Laksa. Semantic finds Katong Laksa too, but ranks it #2, behind Curry Chicken Noodles. Hybrid fuses the two lists by rank (RRF) and promotes Katong Laksa to #1 — recovering a dish neither engine ranked first is exactly what rank fusion is for.",
  },
  {
    query: "something warm and filling to eat when it's raining outside",
    label: "rainy-day comfort food",
    archetype: "pure concept",
    observe:
      "Keyword returns nothing — there's no literal keyword tying this sentence to any dish. Semantic reads the mood and surfaces real comfort food. With no lexical signal to fuse, Hybrid simply inherits Semantic's read — a graceful fallback, not a failure.",
  },
  {
    query: "javanese noodles in sweet potato gravy",
    label: "javanese noodles in sweet potato gravy",
    archetype: "clean win — Hybrid hero",
    observe:
      "Keyword narrowly ranks Curry Chicken Noodles above Mee Rebus — the actual Javanese sweet-potato-gravy dish — on raw token overlap. Semantic correctly leads with Mee Rebus, and Hybrid agrees: fusing by rank (RRF) lets the semantic read win where raw BM25 scores would have kept the wrong dish on top.",
  },
  {
    query: "spicy noodle soup",
    label: "spicy noodle soup, staying in the East",
    archetype: "geospatial filter",
    area: "east",
    observe:
      "Search this without a filter and Hybrid's top picks scatter across the island — Lau Pa Sat, Little India, Beach Road. Apply the East area pill and the same relevance engine runs over a narrower candidate pool: Bak Chor Mee (Bedok) keeps its #1 spot, while the central picks drop out for dishes that are actually in the east — Ayam Bakar (Bedok), Wanton Mee (Joo Chiat). Same ranking logic, just constrained to what's nearby.",
  },
];
