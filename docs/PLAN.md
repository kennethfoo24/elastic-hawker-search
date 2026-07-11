# Hawker Search — Additive Hybrid-Search Progression Demo (Elasticsearch Serverless + Next.js)

## Context

Kenneth (Elastic SA) needs a customer-facing demo that shows **why hybrid search with RRF beats naively combining keyword and semantic scores**, told as a clear left-to-right progression rather than a spread of independent methods. The scenario: a Singapore **hawker food guide** (123 curated dishes, every one with a real photo). Four columns, each adding one technique to the last — **Keyword (BM25) → Semantic (multilingual-e5) → Keyword + Semantic (naive addition) → Keyword + Semantic + Rank (RRF)** — plus a geospatial area filter and dish photos layered on top of all four columns equally. 5 chips, one per teaching point: exact term (all agree) → paraphrase (naive combination fails, RRF fixes it) → pure concept (Keyword empty, others gracefully inherit Semantic) → clean win / Hybrid hero (naive combination still gets it wrong, RRF alone matches the correct semantic read) → geospatial (same relevance, narrower candidate pool).

This design replaced an earlier "4 always-visible columns" (Keyword/Sparse/Dense/Hybrid) version of this demo after the user pressure-tested it with pointed questions ("is this rigged to show what I want?") and asked for the clearer keyword→semantic→combined→RRF story, plus geospatial + photos. See git history for the prior version.

**Target infra:** user's existing **Elastic Cloud Serverless** project (verified: serverless includes RRF retriever with no license tiering, plus the out-of-the-box inference endpoint `.multilingual-e5-small-elasticsearch`; the model auto-deploys on first use). App = Next.js container deployable to **Google Cloud Run**, connected via `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` env vars; identical local `npm run dev` flow.

## Project location

`/Users/kennethfoo/hawker-search` (git repo).

## Stack

Next.js 15 (App Router, TS), Tailwind v4, `@elastic/elasticsearch` v9 (serverless-compatible), `tsx` for scripts. No separate backend.

## File tree

```
hawker-search/
├── app/
│   ├── layout.tsx                 # theme shell, fonts, metadata
│   ├── page.tsx                   # main demo screen (query, area state, 4-column grid)
│   ├── globals.css
│   └── api/search/route.ts        # POST: fan out 4 queries in parallel, attribution, geo distance
├── components/
│   ├── SearchBar.tsx              # search on Enter/chip only (no debounce)
│   ├── AreaFilter.tsx             # Anywhere SG / East / Central / North / West pills
│   ├── QueryChips.tsx             # suggested queries (label only — no archetype tag shown)
│   ├── HeroCollage.tsx            # decorative 2×2 photo collage in the hero (desktop only)
│   ├── TierColumn.tsx / ResultCard.tsx / Icons.tsx
├── lib/
│   ├── es.ts                      # singleton client, apiKey auth, 60s timeout
│   ├── queries.ts                 # the 4 query builders (heart of the demo)
│   ├── geo.ts                     # region centroids, jitter, area presets, haversine
│   ├── tiers.ts                   # column metadata (name/how — no tech subtitle shown)
│   ├── suggested-queries.ts       # 5 demo chips (data)
│   └── types.ts
├── data/dishes.core.json          # ~30 story-critical docs (image_url + notes)
├── data/dishes.extra.json         # 93 filler docs (every doc carries a verified image_url)
├── scripts/seed.ts                # create index + bulk ingest + inject geo + smoke test
├── scripts/warm.ts                # pre-demo warm-up (one semantic query)
├── scripts/validate-chips.ts      # acceptance test: all 5 chips × all 4 columns against the live index
├── Dockerfile                     # 3-stage node:22-alpine, standalone output
├── .env.example                   # ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, ES_INDEX
└── next.config.ts                 # output: "standalone"
```

## Index mapping (`hawker-dishes`)

One doc per dish; `copy_to` fans source fields into the semantic_text field, so each doc is embedded at ingest. `location` is injected at seed time (see below), not authored by hand.

```jsonc
{
  "mappings": { "properties": {
    "name":        { "type": "text", "fields": {"keyword": {"type":"keyword"}}, "copy_to": "semantic_e5" },
    "aliases":     { "type": "text", "copy_to": "semantic_e5" },   // ["叻沙","laksa lemak","curry noodle soup",...]
    "description": { "type": "text", "copy_to": "semantic_e5" },   // 2–3 sentences, ≤512 tokens (e5-small limit)
    "stall":   { "type": "text" },
    "region":  { "type": "keyword" }, "cuisine": { "type": "keyword" },
    "price_sgd": { "type": "float" }, "tags": { "type": "text", "fields": {"keyword": {"type": "keyword"}} },
    "image_url": { "type": "keyword", "index": false },
    "location": { "type": "geo_point" },
    "semantic_e5": { "type": "semantic_text", "inference_id": ".multilingual-e5-small-elasticsearch" }
  } }
}
```

Analyzer: **standard** (unigram CJK is fine and reinforces the "lexical needs literal overlap" story). ICU plugin exists but intentionally not used.

## The 4 query builders (`lib/queries.ts`)

`size: 5` (top-5 per column), retriever framework throughout. `match` is the documented recommended query for semantic_text (8.18+/serverless). Every builder takes an optional `AreaPreset` and wraps its query in a `geo_distance` **filter** (not a ranking signal) so all 4 columns search the same narrowed candidate pool when an area is active.

1. **Keyword — `buildKeyword(q, area?)`:** `standard` retriever → `multi_match` on `["name^3","aliases^2","description","stall","tags"]` with **`minimum_should_match: "75%"`** — genuinely returns nothing when there's no real lexical overlap, instead of a long tail of single-token matches. Default highlighter on description.
2. **Semantic — `buildSemantic(q, area?)`:** `standard` retriever → `match` on `semantic_e5`; semantic highlighter (`"type":"semantic"`, 1 fragment, order score). Cross-lingual (multilingual-e5).
3. **Combined — `buildCombined(q, area?)`:** the naive anti-pattern. One `standard` retriever with a `bool.should` adding the keyword leg's BM25 score directly to the semantic leg's cosine score. Because BM25's scale (often 5–10+) dwarfs cosine similarity (~0.9), this column usually just re-produces Keyword's ranking with the semantic leg along for the ride, doing nothing useful. This is what most hand-rolled "hybrid search" actually looks like.
4. **Hybrid (+RRF) — `buildHybrid(q, area?)`:** `rrf` retriever fusing the *same two legs* (keyword, semantic) by rank instead of raw score — `rank_constant: 60` (documented default), `rank_window_size: 50` (default is 10 — too shallow). Immune to the BM25/cosine scale mismatch that breaks Combined.

**Attribution (money shot):** don't use `explain:true`; the API route already has the keyword/semantic rankings, and Combined/Hybrid's legs are literally the same queries as columns 1 & 2 — annotate each Combined/Hybrid hit "KEY #n · SEM #m" by `_id` lookup in those lists.

## API route (`app/api/search/route.ts`)

`POST { query, area? }` → resolve `area` to an `AreaPreset` (`lib/geo.ts`) → build 4 bodies (keyword, semantic, combined, hybrid) → `Promise.allSettled` of 4 `es.search` calls (per-column timing + ES `took`) → normalized hits `{id, rank, score, name, snippet, region, price_sgd, tags, image_url, location, distanceKm, legRanks?}` → `{ query, area, tiers: {keyword, semantic, combined, hybrid} }`. `distanceKm` is a plain client-independent haversine computed server-side from the active area's center — only set when an area filter is active. `allSettled` so a failing column renders an inline error card with the raw ES message instead of blanking the demo. `export const dynamic = "force-dynamic"`, Node runtime (ES client isn't edge-compatible).

## Dataset (`data/dishes.core.json` + `data/dishes.extra.json`)

123 docs total (30 core + 93 filler). Each core doc's `notes` field (stripped before indexing) records which chip it serves — see the doc itself rather than duplicating that mapping here. Every doc carries a verified `image_url` (Wikimedia Commons thumbnail — filename resolved via the Commons search + imageinfo API and checked for a real `image/*` mime type before being written, never guessed). The dataset originally had 130 docs; 7 filler docs Commons had no suitable free photo for (Fuzhou Oyster Cake, Barley Water, Hainanese Pork Chop, Hotplate Tofu, Muah Chee, Kueh Pie Tee, Min Jiang Kueh) were removed outright rather than shown with a placeholder, after confirming via `scripts/validate-chips.ts` that none of them affected a chip story. `ResultCard.tsx`'s `DishThumb` still has a gradient + monogram `onError` fallback as a defensive safety net, but nothing in the current dataset triggers it.

## Geospatial (`lib/geo.ts`)

- **Geo is a filter, not a ranking signal** — deliberately, so the 4-column relevance comparison stays apples-to-apples even with a location filter active. In a production system geo could instead be a ranking signal (decay function, RRF leg) — not done here on purpose.
- Coordinates are **synthetic**: `REGION_COORDS` gives each of the ~30 Singapore neighbourhoods in the dataset a realistic centroid, and `jitter()` adds a small deterministic per-doc offset (so dishes sharing a region don't stack on one point). Injected in `scripts/seed.ts`'s `onDocument` — none of the 123 hand-authored docs needed lat/lon added by hand.
- Four area pills (`AREA_PRESETS`: East / Central / North / West) were each checked against every region's centroid distance so the presets partition cleanly with no region falling inside two presets at once. Only `Newton` sits in the gap between all four (reachable via "Anywhere SG" only) — a known, acceptable gap in a 123-doc demo dataset.
- `distanceKm` on each hit is a plain haversine from the active preset's center — cosmetic display only.

## Suggested query chips (`lib/suggested-queries.ts`)

Each `{ query, label, archetype, observe, area? }`. All 5 verified against the live index (`npx tsx scripts/validate-chips.ts`):

| # | Query | Archetype | Observe |
|---|---|---|---|
| 1 | `Hainanese chicken rice` | exact term | All four columns agree; Keyword alone is enough |
| 2 | `spicy coconut milk noodle soup` | paraphrase | Keyword and Combined (naive) both rank Nasi Lemak over Katong Laksa — BM25's scale wins even with the semantic leg included. Semantic alone gets Laksa only to #3. Hybrid (+RRF) is the one column that promotes Katong Laksa to #1 |
| 3 | `something warm and filling to eat when it's raining outside` | pure concept | Keyword returns nothing — no literal keyword ties this sentence to any dish. Semantic reads the mood; with no lexical signal to fuse, Combined and Hybrid simply inherit Semantic's read |
| 4 | `javanese noodles in sweet potato gravy` | clean win — **Hybrid hero** | Keyword and Combined both narrowly misrank Curry Chicken Noodles above Mee Rebus (the actual Javanese sweet-potato-gravy dish) on raw token overlap. Semantic alone gets it right. Hybrid (+RRF) is the only column that matches Semantic's correct read — naive addition isn't enough to overturn BM25's scale, rank fusion is |
| 5 | `spicy noodle soup` + area **East** | geospatial filter | Unfiltered, Hybrid's top picks scatter across the island (Lau Pa Sat, Tiong Bahru, Ghim Moh). Filtered to the East, Bak Chor Mee and Mee Soto (both Bedok) keep their top ranks while far-flung picks are replaced by genuinely-East dishes (Katong Laksa, Seafood Hor Fun) |

`archetype` and the tier `tech` fields still exist as data (read by `scripts/validate-chips.ts` and this doc) but are no longer rendered in the UI — chips show only their `label`, and columns show only their `name` — kept off-screen to reduce visual noise per the 2026-07-11 redesign below.

## UI

**Hero banner:** full-bleed GrabFood-green (`--color-brand`, `#00b14f`) band, rounded bottom corners. "Hawker Food" wordmark in **Baloo 2** (`--font-hero`, rounded/bold — visually close to the Grab wordmark), no eyebrow/tagline copy. The 4-step process (Keyword → Semantic → Keyword + Semantic → Keyword + Semantic + Rank) renders as a translucent pill stepper directly under the title, reusing `lib/tiers.ts` names/icons. `HeroCollage.tsx` adds a 2×2 staggered photo collage (Chilli Crab, Hainanese Chicken Rice, Katong Laksa, Chicken Satay — real verified dataset photos) to the right of the title, `lg:` breakpoint and up only.

**Below the hero:** SearchBar → AreaFilter pills → chips row (label only) → 4-column grid (2×2 below xl), columns named **Keyword · Semantic · Keyword + Semantic · Keyword + Semantic + Rank**. TierColumn = column name + icon badge + one-line "how it works" (no technical subtitle) + took-ms + ResultCards (photo thumbnail or gradient-monogram fallback, rank chip, monospace score, name, snippet, stall/region/price line + distance-from-area when active; Combined/Hybrid cards add a 2-node route trail "KEY #n · SEM #m → final rank"). **Hover a card → highlight same doc `_id` across all 4 columns**. Columns distinguished by icon rather than color, column loading skeletons (5 placeholders, matching top-5).

## Seed & warm scripts

- `npm run seed`: delete/create index (new mapping: `location` geo_point, `image_url`, no ELSER) → `helpers.bulk` from the two dishes JSON files, injecting `location` per doc from the region centroid + jitter (small concurrency; 300s timeout — first run auto-deploys the e5 model) → refresh → smoke-test a semantic_e5 match query + a geo doc dump → print counts.
- `npm run warm`: one semantic query; run ~5 min before every demo (ML allocations scale to 0 when idle; cold first query can stall 30s+).

## Docker + Cloud Run

3-stage `node:22-alpine` Dockerfile copying `.next/standalone` + static; `PORT=8080`. Env read at runtime only (one image everywhere). A GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds and pushes the image to Docker Hub (`kennethfoo24/elastic-hawker-search`) on every push to `main`. Deploy that image to Cloud Run with:

```bash
npm run deploy
```

This runs `scripts/deploy-cloud-run.sh`, which reads `ELASTICSEARCH_URL` / `ELASTICSEARCH_API_KEY` / `ES_INDEX` from `.env.local`, pushes the API key into Secret Manager (`hawker-es-api-key`, granting the Cloud Run runtime service account `secretAccessor` — never passed as a plain env var), and deploys the Docker Hub image to the `hawker-search` service in `asia-southeast1`, publicly accessible. Full runbook: [docs/DEPLOY.md](DEPLOY.md).

## Build sequence

**Phase A — local build & review (no Cloud Run):**
1. Scaffold Next.js + Tailwind + ES client + env plumbing; git init.
2. Author `data/dishes.core.json` + `dishes.extra.json` (longest lead item).
3. `scripts/seed.ts` + mapping; run against the serverless project; verify the semantic field and `location` are populated.
4. `lib/queries.ts` + API route; **validate all 4 bodies against the live index for all 5 chips** — tune dataset/query shape until every chip tells its intended story.
5. UI components + chips + area filter + photos + cross-column hover; polish.
6. **Local review checkpoint:** run `npm run dev`, walk through all 5 chips (and the area filter) in the browser; Kenneth reviews the working demo and suggests improvements. Iterate on UI/relevance/dataset here until happy.

**Phase B — deploy (only after Phase A sign-off):**
7. Dockerfile; local `docker build && docker run` smoke test. ✅
8. GitHub Actions → Docker Hub, `scripts/deploy-cloud-run.sh` → Cloud Run (needs Kenneth's gcloud project + Secret Manager setup). ✅ script/CI in place; first live deploy still pending.
9. README with demo runbook: warm-up, chip walk-through script, gotchas. ✅

## Verification

- `npm run seed` completes; `GET hawker-dishes/_count` = dataset size; a doc shows `semantic_e5` populated and a real-looking `location`.
- `npx tsx scripts/validate-chips.ts` — curl-equivalent for all 4 columns across all 5 chips; confirm expected winner per chip (this is the core acceptance test — the demo's story must actually reproduce). Re-run after any dataset or area-preset change.
- `npm run dev` → drive the UI with Playwright MCP: click each chip, verify all 4 columns render (no toggle), confirm chip 2 and chip 4's Combined column visibly fails while Hybrid recovers, confirm chip 5's area pill narrows results with sane distances, confirm every card shows a real photo, confirm Keyword renders genuinely empty on chip 3.
- `docker build` succeeds; container serves on 8080 with env vars.

## Gotchas (bake into README)

1. Cold inference endpoint (scale-to-zero) → warm script + 60s client timeout.
2. RRF: no license concern on serverless (included).
3. Keep descriptions ≤3 sentences (e5-small 512-token limit; keeps 1 chunk/field so highlights are simple).
4. Client major version must match deployment (v9 client for serverless).
5. Geo presets are hand-tuned to partition cleanly against this specific 30-region dataset — re-check `AREA_PRESETS` boundaries in `lib/geo.ts` if regions are added or removed from the dataset.
6. Photo URLs are external Wikimedia hotlinks — verified working at authoring time, but the `DishThumb` `onError` fallback (gradient + monogram) is what actually guarantees nothing renders broken if Commons changes a filename later.
