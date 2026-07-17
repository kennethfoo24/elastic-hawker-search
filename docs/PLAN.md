# Hawker Search — Keyword to Semantic to Hybrid (Elasticsearch Serverless + Next.js)

## Context

Kenneth (Elastic SA) needs a customer-facing demo that tells the **evolution of search** story over a Singapore **hawker food guide** (123 curated dishes, every one with a real photo): an additive left-to-right column progression, **Keyword (BM25) → Semantic (multilingual-e5) → Hybrid (Keyword + Semantic + RRF)**, plus a geospatial area filter and dish photos layered on all columns equally. 5 chips, one per teaching point: exact term (all agree) → paraphrase (RRF recovers a dish neither engine ranked first) → pure concept (Keyword empty, Hybrid gracefully inherits Semantic) → clean win (Semantic's correct read survives fusion) → geospatial (same relevance, narrower candidate pool).

Earlier designs preceded this one (see git history): a "4 always-visible columns" Keyword/Sparse/Dense/Hybrid spread, then a 4-step progression that included a **"Keyword + Semantic (naive score addition)" anti-pattern column** between Semantic and RRF. The naive column was dropped 2026-07-17 at Kenneth's request to tighten the arc ("why RRF beats naive addition" is now a talk-track claim, not a visible column), and the last column was renamed from "…+ Rank" to "…+ RRF" because "Rank" read as a semantic *reranker* — which this demo deliberately does not include (on a 123-doc curated dataset where Hybrid already wins every chip, a reranker visibly changes nothing; it's a talk-track mention). An **Ask mode (RAG)** — side-by-side LLM answers grounded on Keyword vs Hybrid top-5 via EIS `chat_completion` — was prototyped 2026-07-17 and removed the same day at Kenneth's request, before ever being committed.

**Target infra:** user's existing **Elastic Cloud Serverless** project (verified: serverless includes RRF retriever with no license tiering, plus the multilingual e5-large inference endpoint `.microsoft-multilingual-e5-large` on the **Elastic Inference Service** — shared, always-warm, no per-project model deploy or scale-to-zero cold start). App = Next.js container deployable to **Google Cloud Run**, connected via `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` env vars; identical local `npm run dev` flow.

## Project location

`/Users/kennethfoo/hawker-search` (git repo).

## Stack

Next.js 15 (App Router, TS), Tailwind v4, `@elastic/elasticsearch` v9 (serverless-compatible), `tsx` for scripts. No separate backend.

## File tree

```
hawker-search/
├── app/
│   ├── layout.tsx                 # theme shell, fonts, metadata
│   ├── page.tsx                   # main demo screen (query/area state, 3-column grid)
│   ├── globals.css
│   └── api/search/route.ts        # POST: fan out 3 queries in parallel, attribution, geo distance
├── components/
│   ├── SearchBar.tsx              # search on Enter/chip only (no debounce)
│   ├── AreaFilter.tsx             # Anywhere SG / East / Central / North / West pills
│   ├── QueryChips.tsx             # suggested queries (label only — no archetype tag shown)
│   ├── HeroCollage.tsx            # decorative 2×2 photo collage in the hero (desktop only)
│   ├── TierColumn.tsx / ResultCard.tsx / Icons.tsx
├── lib/
│   ├── es.ts                      # singleton client, apiKey auth, 60s timeout
│   ├── queries.ts                 # the 3 query builders (heart of the demo)
│   ├── geo.ts                     # region centroids, jitter, area presets, haversine
│   ├── tiers.ts                   # column metadata (name/how — no tech subtitle shown)
│   ├── suggested-queries.ts       # 5 suggested-query chips (data)
│   └── types.ts
├── data/dishes.core.json          # ~30 story-critical docs (image_url; some carry a dev-facing `notes` field)
├── data/dishes.extra.json         # 93 filler docs (every doc carries a verified image_url)
├── scripts/seed.ts                # create index + bulk ingest + inject geo + smoke test
├── scripts/warm.ts                # pre-demo warm-up (one semantic query)
├── scripts/validate-chips.ts      # acceptance test: all 5 chips × all 3 columns against the live index
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
    "description": { "type": "text", "copy_to": "semantic_e5" },   // 2–3 sentences — keeps 1 chunk/field so highlights stay simple
    "stall":   { "type": "text" },
    "region":  { "type": "keyword" }, "cuisine": { "type": "keyword" },
    "price_sgd": { "type": "float" }, "tags": { "type": "text", "fields": {"keyword": {"type": "keyword"}} },
    "image_url": { "type": "keyword", "index": false },
    "location": { "type": "geo_point" },
    "semantic_e5": { "type": "semantic_text", "inference_id": ".microsoft-multilingual-e5-large" }
  } }
}
```

Analyzer: **standard** (unigram CJK is fine and reinforces the "lexical needs literal overlap" story). ICU plugin exists but intentionally not used.

## The 3 query builders (`lib/queries.ts`)

`size: 5` (top-5 per column), retriever framework throughout. `match` is the documented recommended query for semantic_text (8.18+/serverless). Every builder takes an optional `AreaPreset` and wraps its query in a `geo_distance` **filter** (not a ranking signal) so all columns search the same narrowed candidate pool when an area is active.

1. **Keyword — `buildKeyword(q, area?)`:** `standard` retriever → `multi_match` on `["name^3","aliases^2","description","stall","tags"]` with **`minimum_should_match: "75%"`** — genuinely returns nothing when there's no real lexical overlap, instead of a long tail of single-token matches. Default highlighter on description.
2. **Semantic — `buildSemantic(q, area?)`:** `standard` retriever → `match` on `semantic_e5`; semantic highlighter (`"type":"semantic"`, 1 fragment, order score). Cross-lingual (multilingual-e5-large, served via the Elastic Inference Service).
3. **Hybrid (Keyword + Semantic + RRF) — `buildHybrid(q, area?)`:** `rrf` retriever fusing the *same two legs* (keyword, semantic) by rank instead of raw score — `rank_constant: 60` (documented default), `rank_window_size: 50` (default is 10 — too shallow). Rank fusion is immune to the BM25/cosine scale mismatch that breaks naive score addition (the dropped `buildCombined` column demonstrated that anti-pattern live — see git history).

**Attribution (money shot):** don't use `explain:true`; the API route already has the keyword/semantic rankings, and Hybrid's legs are literally the same queries as columns 1 & 2 — annotate each Hybrid hit "KEY #n · SEM #m" by `_id` lookup in those lists.

## API route (`app/api/search/route.ts`)

`POST { query, area? }` → resolve `area` to an `AreaPreset` (`lib/geo.ts`) → build 3 bodies (keyword, semantic, hybrid) → `Promise.allSettled` of 3 `es.search` calls (per-column timing + ES `took`) → normalized hits `{id, rank, score, name, snippet, region, price_sgd, tags, image_url, location, distanceKm, legRanks?}` → `{ query, area, tiers: {keyword, semantic, hybrid} }`. `distanceKm` is a plain client-independent haversine computed server-side from the active area's center — only set when an area filter is active. `allSettled` so a failing column renders an inline error card with the raw ES message instead of blanking the demo. `export const dynamic = "force-dynamic"`, Node runtime (ES client isn't edge-compatible).

## Dataset (`data/dishes.core.json` + `data/dishes.extra.json`)

123 docs total (30 core + 93 filler). 10 of the 30 core docs carry a `notes` field (stripped before indexing) recording which chip they serve — see the doc itself rather than duplicating that mapping here. Every doc carries a verified `image_url` (Wikimedia Commons thumbnail — filename resolved via the Commons search + imageinfo API and checked for a real `image/*` mime type before being written, never guessed). The dataset originally had 130 docs; 7 filler docs Commons had no suitable free photo for (Fuzhou Oyster Cake, Barley Water, Hainanese Pork Chop, Hotplate Tofu, Muah Chee, Kueh Pie Tee, Min Jiang Kueh) were removed outright rather than shown with a placeholder, after confirming via `scripts/validate-chips.ts` that none of them affected a chip story. `ResultCard.tsx`'s `DishThumb` still has a gradient + monogram `onError` fallback as a defensive safety net, but nothing in the current dataset triggers it.

## Geospatial (`lib/geo.ts`)

- **Geo is a filter, not a ranking signal** — deliberately, so the column relevance comparison stays apples-to-apples even with a location filter active. In a production system geo could instead be a ranking signal (decay function, RRF leg) — not done here on purpose.
- Coordinates are **synthetic**: `REGION_COORDS` gives each of the ~30 Singapore neighbourhoods in the dataset a realistic centroid, and `jitter()` adds a small deterministic per-doc offset (so dishes sharing a region don't stack on one point). Injected in `scripts/seed.ts`'s `onDocument` — none of the 123 hand-authored docs needed lat/lon added by hand.
- Four area pills (`AREA_PRESETS`: East / Central / North / West) were each checked against every region's centroid distance so the presets partition cleanly with no region falling inside two presets at once. Only `Newton` sits in the gap between all four (reachable via "Anywhere SG" only) — a known, acceptable gap in a 123-doc demo dataset.
- `distanceKm` on each hit is a plain haversine from the active preset's center — cosmetic display only.

## Suggested query chips (`lib/suggested-queries.ts`)

Each `{ query, label, archetype, observe, area? }`. All 5 verified against the live index (`npx tsx scripts/validate-chips.ts`):

| # | Query | Archetype | Observe |
|---|---|---|---|
| 1 | `Hainanese chicken rice` | exact term | All three columns agree; Keyword alone is enough |
| 2 | `spicy coconut milk noodle soup` | paraphrase | Keyword barely finds anything and ranks Nasi Lemak over Katong Laksa. Semantic doesn't even surface Katong Laksa in its top 5. Hybrid promotes Katong Laksa to #1 — rank fusion recovering a doc that no single leg ranked highest is the point |
| 3 | `something warm and filling to eat when it's raining outside` | pure concept | Keyword returns nothing — no literal keyword ties this sentence to any dish. Semantic reads the mood; with no lexical signal to fuse, Hybrid simply inherits Semantic's read |
| 4 | `javanese noodles in sweet potato gravy` | clean win | Keyword narrowly misranks Curry Chicken Noodles above Mee Rebus (the actual Javanese sweet-potato-gravy dish) on raw token overlap. Semantic gets it right, and Hybrid's rank fusion lets the correct read win |
| 5 | `spicy noodle soup` + area **East** | geospatial filter | Unfiltered, Hybrid's top picks scatter across the island (Lau Pa Sat, Little India, Beach Road). Filtered to the East, Bak Chor Mee (Bedok) keeps #1 while central picks are replaced by genuinely-eastern dishes (Ayam Bakar/Bedok, Wanton Mee/Joo Chiat) |

`archetype` still exists as data on `SuggestedQuery` (read by `scripts/validate-chips.ts` and this doc) but is no longer rendered in the UI — chips show only their `label`. `TierMeta` (`lib/tiers.ts`) no longer has a `tech` field at all — columns show only their `name`, kept off-screen to reduce visual noise per the 2026-07-11 redesign below.

## UI

**Hero banner:** full-bleed GrabFood-green (`--color-brand`, `#00b14f`) band, rounded bottom corners. "Hawker Food" wordmark in **Baloo 2** (`--font-hero`, rounded/bold — visually close to the Grab wordmark), no eyebrow/tagline copy. The process stepper directly under the title reads from `lib/tiers.ts` (Keyword → Semantic → Hybrid (Keyword + Semantic + RRF)). `HeroCollage.tsx` adds a 2×2 staggered photo collage (Chilli Crab, Hainanese Chicken Rice, Katong Laksa, Chicken Satay — real verified dataset photos) to the right of the title, `lg:` breakpoint and up only.

**Below the hero:** SearchBar → AreaFilter pills → chips row (label only) → 3-column grid (2-up at md, 3-up at xl), columns named **Keyword · Semantic · Hybrid (Keyword + Semantic + RRF)**. TierColumn = column name + icon badge + one-line "how it works" (no technical subtitle) + took-ms + ResultCards (photo thumbnail or gradient-monogram fallback, rank chip, monospace score, name, snippet, stall/region/price line + distance-from-area when active; Hybrid cards add a 2-node route trail "KEY #n · SEM #m → final rank"). **Hover a card → highlight same doc `_id` across all columns**. Columns distinguished by icon rather than color, column loading skeletons (5 placeholders, matching top-5).

## Seed & warm scripts

- `npm run seed`: delete/create index (new mapping: `location` geo_point, `image_url`, no ELSER) → `helpers.bulk` from the two dishes JSON files, injecting `location` per doc from the region centroid + jitter (small concurrency; 300s timeout headroom, but EIS has no per-project model deploy to wait on — completes in seconds) → refresh → smoke-test a semantic_e5 match query + a geo doc dump → print counts.
- `npm run warm`: one semantic query, kept as an optional connectivity smoke test. Not required before a demo — `semantic_e5` runs on the Elastic Inference Service (EIS), which is shared and always-warm (no per-project ML allocation, no cold start).

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
- `npx tsx scripts/validate-chips.ts` — curl-equivalent for all 3 columns across all 5 chips; confirm expected winner per chip (this is the core acceptance test — the demo's story must actually reproduce). Re-run after any dataset or area-preset change.
- `npm run dev` → drive the UI with Playwright MCP: click each chip, verify the 3 columns and Hybrid's KEY/SEM trail, confirm chip 5's area pill narrows results with sane distances, confirm every card shows a real photo, confirm Keyword renders genuinely empty on chip 3; 0 console errors.
- `docker build` succeeds; container serves on 8080 with env vars.

## Gotchas (bake into README)

1. ~~Cold inference endpoint (scale-to-zero) → warm script + 60s client timeout.~~ No longer applies: `semantic_e5` moved from an ML-node-hosted endpoint to the Elastic Inference Service (EIS), which has no per-project allocation to cold-start. `npm run warm` is now just an optional connectivity check.
2. RRF: no license concern on serverless (included).
3. Keep descriptions ≤3 sentences — keeps 1 chunk/field so highlights stay simple, independent of which embedding model backs `semantic_e5`.
4. Client major version must match deployment (v9 client for serverless).
5. Geo presets are hand-tuned to partition cleanly against this specific 30-region dataset — re-check `AREA_PRESETS` boundaries in `lib/geo.ts` if regions are added or removed from the dataset.
6. Photo URLs are external Wikimedia hotlinks — verified working at authoring time, but the `DishThumb` `onError` fallback (gradient + monogram) is what actually guarantees nothing renders broken if Commons changes a filename later.
