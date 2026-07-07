# Hawker Search — 4-Tier Relevance Demo (Elasticsearch Serverless + Next.js)

## Context

Kenneth (Elastic SA) needs a customer-facing demo that shows **why hybrid search with RRF beats lexical-only, semantic-only, and naive hybrid**, with a bonus **sparse-vs-dense** story for multilingual Singapore (English / Chinese / Malay / Tamil). The scenario: a Singapore **hawker food guide** (~130 curated dishes). Queries come in 4 archetypes that make each tier's strengths/failures visible: exact dish names (BM25 wins), paraphrases (semantic wins), mixed exact+concept (RRF wins), and cross-lingual queries (dense multilingual-e5 wins where sparse ELSER fails, since ELSER is English-only).

**Target infra:** user's existing **Elastic Cloud Serverless** project (verified: serverless includes RRF retriever with no license tiering, plus out-of-the-box inference endpoints `.elser-2-elasticsearch` sparse and `.multilingual-e5-small-elasticsearch` dense; models auto-deploy on first use). App = Next.js container deployable to **Google Cloud Run**, connected via `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` env vars; identical local `npm run dev` flow.

## Project location

New repo at `/Users/kennethfoo/hawker-search` (git init).

## Stack

Next.js 15 (App Router, TS), Tailwind v4, `@elastic/elasticsearch` v9 (serverless-compatible), `tsx` for scripts. No separate backend.

## File tree

```
hawker-search/
├── app/
│   ├── layout.tsx                 # theme shell, fonts, metadata
│   ├── page.tsx                   # main demo screen
│   ├── globals.css
│   └── api/search/route.ts        # POST: fan out 4 queries in parallel
├── components/
│   ├── SearchBar.tsx              # search on Enter/chip only (no debounce)
│   ├── QueryChips.tsx             # suggested queries w/ "what to observe" annotations
│   ├── ModelToggle.tsx            # ELSER (sparse) ⇄ multilingual-e5 (dense)
│   ├── TierColumn.tsx / TierHeader.tsx / ResultCard.tsx
├── lib/
│   ├── es.ts                      # singleton client, apiKey auth, 60s timeout
│   ├── queries.ts                 # the 4 query builders (heart of the demo)
│   ├── suggested-queries.ts       # 8 demo chips (data)
│   └── types.ts
├── data/dishes.json               # ~130 curated multilingual docs
├── scripts/seed.ts                # create index + bulk ingest + smoke test
├── scripts/warm.ts                # pre-demo warm-up (one semantic query per model)
├── Dockerfile                     # 3-stage node:22-alpine, standalone output
├── .env.example                   # ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, ES_INDEX
└── next.config.ts                 # output: "standalone"
```

## Index mapping (`hawker-dishes`)

One doc per dish; `copy_to` fans source fields into **both** semantic_text fields (verified supported), so each doc is embedded sparse + dense at ingest:

```jsonc
{
  "mappings": { "properties": {
    "name":        { "type": "text", "fields": {"keyword": {"type":"keyword"}}, "copy_to": ["semantic_elser","semantic_e5"] },
    "aliases":     { "type": "text", "copy_to": ["semantic_elser","semantic_e5"] },   // ["叻沙","laksa lemak","curry noodle soup",...]
    "description": { "type": "text", "copy_to": ["semantic_elser","semantic_e5"] },   // 2–3 sentences, ≤512 tokens (e5-small limit)
    "stall":   { "type": "text" },
    "region":  { "type": "keyword" }, "cuisine": { "type": "keyword" },
    "price_sgd": { "type": "float" }, "tags": { "type": "keyword" },
    "semantic_elser": { "type": "semantic_text", "inference_id": ".elser-2-elasticsearch" },
    "semantic_e5":    { "type": "semantic_text", "inference_id": ".multilingual-e5-small-elasticsearch" }
  } }
}
```

Analyzer: **standard** (unigram CJK is fine and reinforces the "lexical needs literal overlap" story). Note in README: ICU plugin exists but intentionally not used.

## The 4 queries (`lib/queries.ts`)

All functions of `(q, semField)` where `semField = "semantic_elser" | "semantic_e5"`, `size: 10`, retriever framework. `match` is the documented recommended query for semantic_text (8.18+/serverless).

1. **Lexical:** `standard` retriever → `multi_match` on `["name^3","aliases^2","description","tags"]`; default highlighter on description.
2. **Semantic:** `standard` retriever → `match` on `semField`; **semantic highlighter** (`"type":"semantic"`, 1 fragment, order score).
3. **Naive hybrid (anti-pattern):** `standard` retriever → `bool.should` [multi_match `_name:"lexical_leg"`, match-on-semField `_name:"semantic_leg"`] — raw score addition. Render `matched_queries` as leg badges. Talking point: ELSER scores (~10–20) swamp BM25; e5 scores (~1) get swamped — the imbalance flips with the model toggle.
4. **RRF:** `rrf` retriever with the same two legs as standalone retrievers; `rank_constant: 60` (explicit), `rank_window_size: 50` (default is 10 — too shallow). RRF returns real `_score` (Σ 1/(rank+60), ~0.016–0.033) — display with 4 decimals, caption "Σ 1/(rank+60)".

**RRF attribution (money shot):** don't use `explain:true`; the API route already has tier-1/tier-2 rankings, and RRF's legs are identical queries — annotate each RRF hit "lex #n · sem #m" by `_id` lookup in those lists.

## API route (`app/api/search/route.ts`)

`POST { query, model: "elser"|"e5" }` → build 4 bodies → `Promise.allSettled` of 4 `es.search` (per-tier timing + ES `took`) → normalized hits `{id, rank, score, name, snippet, region, price_sgd, tags, matchedQueries?, rrfLegRanks?}` → `{ tiers: {lexical, semantic, naiveHybrid, rrf}, tookMs }`. `allSettled` so a failing tier renders an inline error card with the raw ES message instead of blanking the demo. `export const dynamic = "force-dynamic"`, Node runtime (ES client isn't edge-compatible).

## Dataset (`data/dishes.json`)

~130 docs I'll author (then Kenneth spot-checks translations). Requirements:
- English name + rich 2–3 sentence description (flavor/texture/ingredient vocabulary so paraphrases land)
- `aliases` mixing zh/ms/ta script where authentic (叻沙, mee goreng, தோசை)
- ~10 docs with non-English descriptions (shows ELSER degrading on non-English content)
- Must cover dishes referenced by the chips: laksa, Hainanese chicken rice, char kway teow, sambal stingray, fish head curry, roti prata, bak kut teh, mee goreng, thosai, chendol, kaya toast, etc.

## Suggested query chips (`lib/suggested-queries.ts`)

Each `{ query, label, observe, expectedWinner, suggestedModel? }`:

| # | Query | Archetype | Observe |
|---|---|---|---|
| 1 | `laksa` | exact name | all tiers agree; BM25 sufficient |
| 2 | `Hainanese chicken rice` | exact multi-word | BM25 wins decisively |
| 3 | `spicy coconut milk noodle soup` | paraphrase | lexical misses laksa; semantic nails it |
| 4 | `grilled fish wrapped in banana leaf` | paraphrase | sambal stingray only via semantic |
| 5 | `halal noodle soup in Bedok` | mixed | **RRF beats both legs — headline chip** |
| 6 | `comfort food for a rainy day under $5` | pure concept | ELSER shines on English abstraction |
| 7 | `辣椰浆汤面` (zh) | cross-lingual | ELSER fails → flip toggle → e5 finds laksa |
| 8 | `மீன் தலை கறி` (ta, "fish head curry") | cross-lingual non-Latin | sparse-vs-dense punchline |

## UI

Header (title + ModelToggle) → SearchBar → chips row → 4-column grid (2×2 below xl). TierColumn = tier name + one-line "how it works" + took-ms + ResultCards (rank chip, monospace score, name, snippet, region/price/tag pills; RRF cards add "lex #n · sem #m"; naive-hybrid cards add leg badges). **Hover a card → highlight same doc `_id` across all 4 columns** (best visual for rank movement). Polished dark theme, one accent color, column loading skeletons. Follow frontend-design skill during implementation.

## Seed & warm scripts

- `npm run seed`: delete/create index → `helpers.bulk` from dishes.json (small concurrency; 300s timeout — first run auto-deploys both models, budget 5–10 min) → refresh → smoke-test one match query per semantic field → print counts.
- `npm run warm`: one semantic query per model; run ~5 min before every demo (ML allocations scale to 0 when idle; cold first query can stall 30s+).

## Docker + Cloud Run

3-stage `node:22-alpine` Dockerfile copying `.next/standalone` + static; `PORT=8080`. Env read at runtime only (one image everywhere). Deploy:

```bash
gcloud run deploy hawker-search --source . --region asia-southeast1 --allow-unauthenticated \
  --set-env-vars ELASTICSEARCH_URL=... --set-secrets ELASTICSEARCH_API_KEY=hawker-es-api-key:latest
```

(API key in Secret Manager; grant run SA `secretAccessor`.)

## Build sequence

**Phase A — local build & review (no Cloud Run):**
1. Scaffold Next.js + Tailwind + ES client + env plumbing; git init.
2. Author `data/dishes.json` (longest lead item).
3. `scripts/seed.ts` + mapping; run against the serverless project; verify both semantic fields populated.
4. `lib/queries.ts` + API route; **validate all 4 bodies with curl against the live index, including chips 7–8 under both models** — tune dataset/boosts until every chip tells its intended story.
5. UI components + chips + toggle + cross-column hover; polish.
6. **Local review checkpoint:** run `npm run dev`, walk through all 8 chips in the browser, share screenshots; Kenneth reviews the working demo and suggests improvements. Iterate on UI/relevance/dataset here until happy.

**Phase B — deploy (only after Phase A sign-off):**
7. Dockerfile; local `docker build && docker run` smoke test.
8. Cloud Run deploy (needs Kenneth's gcloud project + Secret Manager setup).
9. README with demo runbook: warm-up, chip walk-through script, gotchas.

## Verification

- `npm run seed` completes; `GET hawker-dishes/_count` = dataset size; a doc shows both inference fields populated.
- curl each of the 4 query bodies for chips 1–8 under both models; confirm expected winner per chip (this is the core acceptance test — the demo's story must actually reproduce).
- `npm run dev` → drive the UI with Playwright MCP: click each chip, verify 4 columns render, flip model toggle on chip 7 and confirm the semantic column changes, take screenshot.
- `docker build` succeeds; container serves on 8080 with env vars.

## Gotchas (bake into README)

1. Cold inference endpoints (scale-to-zero) → warm script + 60s client timeout.
2. RRF: no license concern on serverless (included).
3. ELSER is English-only — chips 7–8 intentionally demonstrate this.
4. Naive-hybrid dominance direction flips with model toggle — present as a feature.
5. Keep descriptions ≤3 sentences (e5-small 512-token limit; keeps 1 chunk/field so highlights are simple).
6. Client major version must match deployment (v9 client for serverless).
