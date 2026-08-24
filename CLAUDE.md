# Hawker Search — Evolution of Search Demo

Customer-facing Elastic demo over a multilingual Singapore hawker-food dataset: an additive progression across three columns — **Keyword (BM25) → Semantic (dense embeddings) → Hybrid (Keyword + Semantic + RRF)**. Each column adds one technique to the last, so the value (and failure mode) of each step is visible without touching a toggle. A geo `distance` filter (area pills) and dish photos are layered on top, on every column equally.

Full design: [docs/PLAN.md](docs/PLAN.md).

## Stack & infra

- Next.js 15 (App Router, TS), Tailwind v4, `@elastic/elasticsearch` v9
- Elasticsearch = **Elastic Cloud Serverless** (RRF included out of the box; semantic embeddings run on the **Elastic Inference Service** via `.openai-text-embedding-3-large` — shared, always-warm, no per-project ML allocation or cold start)
- Env (`.env.local`, never committed): `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, optional `ES_INDEX` (default `hawker-dishes`)
- Deploy target (Phase B only): Docker → Google Cloud Run, `asia-southeast1`

## Commands

- `npm run dev` — local demo at :3000
- `npm run seed` — recreate index + bulk ingest `data/*.json` (seconds, not minutes — EIS has no per-project model deploy to wait on)
- `npm run warm` — one semantic query as a connectivity smoke test; not required before a demo (EIS is always warm)
- `npx tsx scripts/validate-chips.ts` — curl-equivalent acceptance test for all 5 chips across all 3 columns; the demo's core "does the story actually reproduce" check
- `npm run deploy` — deploy the latest Docker Hub image to Cloud Run (`scripts/deploy-cloud-run.sh`); see [docs/DEPLOY.md](docs/DEPLOY.md)

## Architecture notes

- `lib/queries.ts` holds the 3 query builders — the heart of the demo — plus `buildQuery(tier, q, area)`, a single dispatch point from a `TierKey` to its builder shared by the search API route and the validate script. All use the retriever framework; `match` on `semantic_text` is the recommended semantic query. `size: 5` everywhere (top-5 per column).
  - `buildKeyword` — `multi_match` with **`minimum_should_match: "75%"`**, so a query with no real lexical overlap returns genuinely nothing (empty column), not a long tail of single-token noise.
  - `buildSemantic` — `match` on `semantic_e5` (multilingual-e5-large via EIS, cross-lingual dense retrieval). ELSER was removed from this build — one semantic model keeps the progression clean instead of adding a sparse-vs-dense fork.
  - `buildHybrid` — the same two legs fused by **RRF** (`rank_constant: 60`, `rank_window_size: 50`) instead of raw score — immune to the BM25/cosine scale mismatch that breaks naive score addition. (A `buildCombined` "naive addition" anti-pattern column between Semantic and Hybrid was dropped 2026-07-17 to tighten the arc; see git history if reviving it. RRF ≠ a semantic *reranker* — no reranker exists in this demo, deliberately: hybrid already wins every chip on this curated dataset, so a reranker would visibly change nothing.)
  - Every builder takes an optional `AreaPreset` (see `lib/geo.ts`) and wraps its query in a `geo_distance` **filter** — geo narrows the candidate pool identically for all columns, it never re-ranks. This keeps every comparison apples-to-apples even with a location filter active.
- Hybrid shows 2-node per-leg attribution ("KEY #n · SEM #m") computed by `_id` lookup against the keyword/semantic tiers — do not use `explain:true` in the app. The keyword leg inside Hybrid is the *exact same* `minimum_should_match` query as column 1, so the "KEY #n" shown is honest, not a different internal definition.
- **Geospatial** (`lib/geo.ts`): coordinates are synthetic — a `REGION_COORDS` centroid per Singapore neighbourhood + deterministic per-doc jitter, injected at seed time in `scripts/seed.ts`'s `onDocument` (none of the 123 hand-authored docs needed real lat/lon added by hand). Four area pills (`AREA_PRESETS`) were each checked against every region's centroid so they partition cleanly with no cross-contamination between "East"/"Central"/"North"/"West" (only the `Newton` region falls in the gap between all four — reachable only via "Anywhere SG", a known/acceptable gap). Distance shown on cards is a plain client-side haversine from the active area's center — cosmetic, doesn't affect ranking.
- **Photos**: every doc in the dataset (all 30 core + all 93 filler) carries a verified `image_url` — a Wikimedia Commons thumbnail whose filename was resolved through the Commons search + imageinfo API and checked for a real `image/*` mime type before being written, never guessed. The 7 filler docs Commons had no reasonable photo for (Fuzhou Oyster Cake, Barley Water, Hainanese Pork Chop, Hotplate Tofu, Muah Chee, Kueh Pie Tee, Min Jiang Kueh) were removed from the dataset entirely rather than shown with a placeholder — confirmed via `scripts/validate-chips.ts` that none of the 5 chip stories depended on them. `ResultCard.tsx`'s `DishThumb` still has a gradient + monogram `onError` fallback as a defensive safety net (e.g. if a Commons URL ever breaks, or new docs are added later without a photo), but nothing in the current dataset triggers it.
- `data/dishes.core.json` = 30 story-critical docs hand-tuned so each suggested-query chip lands (see chip table in docs/PLAN.md; 10 of the 30 carry a dev-facing `notes` field noting which chip they serve — `notes` is stripped before indexing); `data/dishes.extra.json` = 93 filler docs.
- Text fields use the standard analyzer on purpose (no stemming, unigram CJK) — makes lexical failure modes crisp and explainable.
- 5 suggested-query chips, one per teaching point: **exact term** (all 3 columns agree) → **paraphrase** (Keyword wrongly ranks Nasi Lemak over Katong Laksa, Semantic misses Laksa entirely; RRF promotes it to #1 — rank fusion recovering a doc neither leg ranked first) → **pure concept** (Keyword returns nothing; Hybrid gracefully inherits the semantic read) → **clean win** (Keyword misranks Curry Chicken Noodles over Mee Rebus; Semantic's correct read survives fusion) → **geospatial filter** (same query, same ranking logic, narrowed to the East — far-flung results drop out, genuinely-nearby ones surface). Chip `observe` copy was re-synced to live results 2026-07-17 (it had drifted after the e5-large reseed — chips 2/5 named dishes that no longer appear).

## UI & branding

- GrabFood-inspired visual redesign (2026-07-11): full-bleed hero banner in brand green (`--color-brand`, `#00b14f`, `app/globals.css`), "Hawker Food" wordmark set in **Baloo 2** (`--font-hero`, loaded in `app/layout.tsx`) — rounded/bold, visually close to the Grab wordmark. `components/HeroCollage.tsx` adds a 2×2 staggered photo collage (Chilli Crab, Hainanese Chicken Rice, Katong Laksa, Chicken Satay — real verified photos already in the dataset) to the right of the hero title, shown at `lg:` breakpoint and up only.
- Copy was deliberately stripped from the UI to cut visual noise: no more eyebrow/tagline text in the header, no tier `tech` subtitle under each column name (e.g. "BM25 multi_match"), no chip `archetype` label (e.g. "paraphrase") above each suggested query. `TierMeta` (`lib/tiers.ts`) no longer has a `tech` field at all. `archetype` still exists on `SuggestedQuery` (`lib/suggested-queries.ts`) — it's read by `scripts/validate-chips.ts` and documented in `docs/PLAN.md`, just not rendered.
- The 3 columns are named for display as **Keyword → Semantic → Hybrid (Keyword + Semantic + RRF)** (`lib/tiers.ts` `TIERS[].name`) — the hero's process stepper reads from the same array, so renaming a tier there updates both places. The last column was renamed from "…+ Rank" because "Rank" read as a semantic reranker; it's RRF.

## Current state (2026-07-11)

- [x] Scaffold, deps, git init
- [x] Dataset: 123 docs (`dishes.core.json` 30 story-critical + `dishes.extra.json` 93 filler), every doc carries a verified photo
- [x] lib/ (es client, types, queries, geo, tiers, chips) + seed/warm/validate-chips scripts
- [x] Redesigned from 4 always-visible columns (Keyword/Sparse/Dense/Hybrid) to a 4-step **additive progression** (Keyword → Semantic → Keyword+Semantic naive → +RRF), after the user asked pointed "is this rigged?" questions about the prior model and requested a clearer keyword→semantic→combined→RRF story
- [x] Added geospatial area filter (geo_distance filter, not a ranking signal) and dish photos (verified Wikimedia Commons + gradient fallback)
- [x] Keyword column genuinely empty when there's no real lexical overlap (`minimum_should_match: "75%"`), top-5 everywhere
- [x] Reseeded (ELSER dropped, `location`/`image_url` added to the mapping) and re-validated all 5 chips against the live index (`npx tsx scripts/validate-chips.ts`) — including tuning the area-preset boundaries so they don't leak neighbouring regions into a filtered result
- [x] Photo coverage: 123/130 docs got a verified Commons photo; the 7 that didn't were removed from the dataset entirely (confirmed via validate-chips that none affected a chip story), so every remaining result now shows a real photo — confirmed via live browser across multiple chips, 0 console errors
- [x] Fresh full browser smoke test of the 4-column progression UI end to end (Playwright, empty state + populated results, multiple viewport widths)
- [x] Visual redesign pass: sleeker minimalist hero, reduced copy verbosity, then a GrabFood-inspired restyle (brand green hero, Baloo 2 wordmark "Hawker Food", 4 columns renamed, tier/chip subtitle copy removed, hero photo collage) — confirmed live via Playwright screenshots at desktop/tablet widths
- [x] Phase B plumbing: multi-stage `Dockerfile` (Next.js standalone output, `node:22-alpine`), GitHub Actions workflow building/pushing to Docker Hub (`kennethfoo24/elastic-hawker-search`) on push to `main`, `scripts/deploy-cloud-run.sh` (`npm run deploy`) deploying that image to Cloud Run with the ES API key in Secret Manager (not a plain env var) — full runbook in `docs/DEPLOY.md`
- [x] Switched `semantic_e5` from the ML-node-hosted `.multilingual-e5-small-elasticsearch` (adaptive allocations scale to zero when idle, ~30s+ cold-start risk mid-demo) to `.microsoft-multilingual-e5-large` on the **Elastic Inference Service** (shared, always-warm, billed per-token instead of per-VCU-hour) — reseeded and re-ran `validate-chips.ts`; all 5 chip stories reproduce with no dataset re-tuning needed, `npm run warm` is now optional

## Current state (2026-07-12)

- [x] Repo cleanup pass: removed dead code (unused `Dish` type, unused `cuisine`/`esTookMs`/`totalHits` API fields, leftover `create-next-app` scaffold SVGs in `public/`), fixed `.gitignore` (`.env.example` now trackable, `.claude/` local state ignored), extracted the shared `buildQuery` dispatcher into `lib/queries.ts`, added a warning log for unrecognized regions in `coordForRegion`, corrected doc drift in `docs/PLAN.md` (stale `tech`-field claim, `notes`-field coverage), cleared accumulated local Playwright MCP session logs

## Current state (2026-07-17)

- [x] Search progression simplified 4 → 3 columns: the naive "Keyword + Semantic (score addition)" anti-pattern column dropped (Kenneth's call — "why RRF" is now talk-track), last column renamed **Hybrid (Keyword + Semantic + RRF)** because "+ Rank" misread as a reranker; re-ran `validate-chips.ts` (all 5 stories hold on 3 columns) and re-synced chip 2/5 `observe` copy that had drifted from live results after the e5-large reseed
- [x] An **Ask mode (RAG)** — hero Search↔Ask toggle, side-by-side answers grounded on Keyword vs Hybrid top-5 via EIS `chat_completion`, 3 ask chips, `scripts/validate-ask.ts` — was prototyped the same day and then **removed at Kenneth's request before ever being committed**; the demo is Search-only again. If reviving: EIS chat endpoints are stream-only (raw fetch to `_inference/chat_completion/{id}/_stream`), zero-hit grounding must short-circuit without an LLM call, and a "keyword grounds the wrong dish" chip won't reproduce on this dataset (the right dish always sneaks into keyword top-5 and the LLM rescues it)
- [x] First live Cloud Run deploy (2026-07-17): `hawker-search` service in `asia-southeast1`, project `elastic-sa` — https://hawker-search-1059491012611.asia-southeast1.run.app (smoke-tested live: search 200 with correct results, no Ask surface)
- [ ] Demo runbook walkthrough with Kenneth

## Current state (2026-08-24)

- [x] `.microsoft-multilingual-e5-large` was retired from the Elastic Inference Service catalog sometime after 2026-07-17 (confirmed via live `GET _inference` against the project — endpoint no longer listed, live Semantic/Hybrid columns were throwing `resource_not_found_exception`). Evaluated replacements against the actual chip stories, not just "does it error":
  - `.jina-embeddings-v3` and `.jina-embeddings-v5-text-small` — both EIS-hosted (no cold start, confirmed empirically: first call 327ms, no spin-up delay) but both are *too accurate* for this dataset — Semantic alone now ranks Katong Laksa #1 on the paraphrase chip, leaving nothing for RRF to "recover." Jina's models are also CC BY-NC 4.0 (non-commercial) licensed by Jina AI, a real caveat for a customer-facing demo.
  - `.multilingual-e5-small-elasticsearch` (the ML-node model dropped 2026-07-17) reproduces all 5 chip stories closely, but reintroduces the scale-to-zero cold-start risk. Tried pinning `min_number_of_allocations: 1` to keep an ML node always warm — **not possible on Elastic Cloud Serverless**: editing the preconfigured `.`-prefixed endpoint is rejected outright, and a custom endpoint created against the same model had Serverless silently reset the minimum back to 0. Always-on ML node allocation is a self-managed/ECH concept, not available here.
  - **`.openai-text-embedding-3-large`** — EIS-hosted (no cold start, 6s reseed), reproduces chip 1 exactly (all 3 columns agree) and chip 2 correctly (Katong Laksa sits at #2 in both Keyword and Semantic individually, RRF promotes it to #1 — a clean "recovered by rank fusion" story), and is governed by OpenAI's standard commercial Services Agreement (no non-commercial restriction). **This is what `semantic_e5` now uses.**
  - Re-synced chip 2's `observe` copy ("doesn't even surface it in its top 5" → "ranks it #2, behind Curry Chicken Noodles") to match live results, re-ran `validate-chips.ts` — all 5 chip stories hold.
