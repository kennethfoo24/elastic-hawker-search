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
      "All four columns agree — when keywords match, Keyword alone is enough. Semantic, Combined and Hybrid add nothing here, and cost more to run.",
  },
  {
    query: "spicy coconut milk noodle soup",
    label: "spicy coconut milk noodle soup",
    archetype: "paraphrase",
    observe:
      "Keyword barely finds anything and ranks Nasi Lemak over Katong Laksa. Semantic understands the paraphrase but only gets Laksa to #3. Keyword + Semantic (naive addition) still ranks Nasi Lemak #1 — BM25's larger scale drowns out the semantic signal. Hybrid (+RRF) is the one column that promotes Katong Laksa to #1, by rank instead of raw score.",
  },
  {
    query: "something warm and filling to eat when it's raining outside",
    label: "rainy-day comfort food",
    archetype: "pure concept",
    observe:
      "Keyword returns nothing — there's no literal keyword tying this sentence to any dish. Semantic reads the mood and surfaces real comfort food. With no lexical signal to fuse, Combined and Hybrid simply inherit Semantic's read — a graceful fallback, not a failure.",
  },
  {
    query: "javanese noodles in sweet potato gravy",
    label: "javanese noodles in sweet potato gravy",
    archetype: "clean win — Hybrid hero",
    observe:
      "Keyword narrowly ranks Curry Chicken Noodles above Mee Rebus — the actual Javanese sweet-potato-gravy dish — on raw token overlap. Semantic correctly leads with Mee Rebus. But Keyword + Semantic (naive addition) still keeps Curry Chicken Noodles on top — adding the semantic score isn't enough to overturn BM25's larger scale. Hybrid (+RRF) is the one column that matches Semantic's correct read, because it fuses by rank, not magnitude.",
  },
  {
    query: "spicy noodle soup",
    label: "spicy noodle soup, staying in the East",
    archetype: "geospatial filter",
    area: "east",
    observe:
      "Search this without a filter and Hybrid's top picks scatter across the island — Lau Pa Sat, Tiong Bahru, Ghim Moh. Apply the East area pill and the same relevance engine runs over a narrower candidate pool: Bak Chor Mee and Mee Soto (both Bedok) keep their top ranks, while genuinely-East dishes like Katong Laksa and Seafood Hor Fun (East Coast) replace the far-flung ones. Same ranking logic, just constrained to what's actually nearby.",
  },
];
