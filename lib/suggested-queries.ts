import type { SemModel } from "./types";

export interface SuggestedQuery {
  query: string;
  label: string;
  archetype: string;
  observe: string;
  /** switch the model toggle to this before running, if set */
  suggestedModel?: SemModel;
}

export const SUGGESTED_QUERIES: SuggestedQuery[] = [
  {
    query: "laksa",
    label: "laksa",
    archetype: "exact name",
    observe: "All four tiers agree — when keywords match, BM25 alone is enough.",
  },
  {
    query: "Hainanese chicken rice",
    label: "Hainanese chicken rice",
    archetype: "exact multi-word",
    observe: "BM25 wins decisively on the literal name; semantic adds little here.",
  },
  {
    query: "spicy coconut milk noodle soup",
    label: "spicy coconut milk noodle soup",
    archetype: "paraphrase",
    observe:
      "Lexical latches onto literal words and surfaces nasi lemak ('coconut milk'); semantic understands you mean laksa.",
  },
  {
    query: "grilled fish wrapped in banana leaf",
    label: "grilled fish in banana leaf",
    archetype: "paraphrase",
    observe:
      "Lexical finds things literally containing 'banana leaf' (thosai, banana leaf rice); only semantic surfaces sambal stingray and otah.",
  },
  {
    query: "halal noodle soup in Bedok",
    label: "halal noodle soup in Bedok",
    archetype: "mixed exact + concept",
    observe:
      "Lexical anchors 'halal'/'Bedok' but top-ranks non-halal bak chor mee; semantic finds noodle soups anywhere. Only RRF puts halal mee soto at Bedok on top — rank fusion rewards agreement.",
  },
  {
    query: "comfort food for a rainy day under $5",
    label: "rainy-day comfort food",
    archetype: "pure concept",
    observe:
      "Lexical is near-random on abstract intent; ELSER shines on English abstraction. (Note: '$5' isn't a real filter — segue into structured filtering.)",
  },
  {
    query: "辣椰浆汤面",
    label: "辣椰浆汤面 (zh)",
    archetype: "cross-lingual",
    observe:
      "Chinese for 'spicy coconut broth noodles'. With ELSER (English-only) the semantic column is noise; flip to e5 and laksa appears from English docs. Lexical only matches stray 辣/面 characters.",
    suggestedModel: "e5",
  },
  {
    query: "மீன் தலை கறி",
    label: "மீன் தலை கறி (ta)",
    archetype: "cross-lingual, non-Latin",
    observe:
      "Tamil for 'fish head curry' — zero lexical overlap with the docs. Sparse ELSER fails; dense multilingual-e5 retrieves it cross-lingually. The sparse-vs-dense punchline.",
    suggestedModel: "e5",
  },
];
