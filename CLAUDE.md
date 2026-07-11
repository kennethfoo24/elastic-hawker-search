# Hawker Search — Additive Hybrid-Search Progression Demo

Customer-facing Elastic demo: an additive progression across four columns — **Keyword (BM25) → Semantic (multilingual-e5) → Keyword + Semantic (naive score addition) → + RRF** — over a multilingual Singapore hawker-food dataset. Each column adds one technique to the last, so the value (and the failure mode) of each step is visible without touching a toggle: Semantic adds meaning, naive Combined shows why simply adding scores together is an anti-pattern, and Hybrid (RRF) is the fix. A geo `distance` filter (area pills) and dish photos are layered on top, on every column equally. Full design: [docs/PLAN.md](docs/PLAN.md).

## Stack & infra

- Next.js 15 (App Router, TS), Tailwind v4, `@elastic/elasticsearch` v9
- Elasticsearch = **Elastic Cloud Serverless** (RRF + default inference endpoint `.multilingual-e5-small-elasticsearch` included out of the box)
- Env (`.env.local`, never committed): `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, optional `ES_INDEX` (default `hawker-dishes`)
- Deploy target (Phase B only): Docker → Google Cloud Run, `asia-southeast1`

## Commands

- `npm run dev` — local demo at :3000
- `npm run seed` — recreate index + bulk ingest `data/*.json` (first run auto-deploys the e5 model; budget a few minutes)
- `npm run warm` — one semantic query; run ~5 min before any live demo (ML scales to zero when idle)
- `npx tsx scripts/validate-chips.ts` — curl-equivalent acceptance test for all 5 chips across all 4 columns; the demo's core "does the story actually reproduce" check
- `npm run deploy` — deploy the latest Docker Hub image to Cloud Run (`scripts/deploy-cloud-run.sh`); see [docs/DEPLOY.md](docs/DEPLOY.md)

## Architecture notes

- `lib/queries.ts` holds the 4 query builders — the heart of the demo. All use the retriever framework; `match` on `semantic_text` is the recommended semantic query. `size: 5` everywhere (top-5 per column).
  - `buildKeyword` — `multi_match` with **`minimum_should_match: "75%"`**, so a query with no real lexical overlap returns genuinely nothing (empty column), not a long tail of single-token noise.
  - `buildSemantic` — `match` on `semantic_e5` (multilingual-e5, cross-lingual dense retrieval). ELSER was removed from this build — one semantic model keeps the progression a clean 4 steps instead of a 5th sparse-vs-dense fork.
  - `buildCombined` — the naive anti-pattern: one `bool.should` adding the keyword leg's BM25 score to the semantic leg's cosine score directly. BM25's larger scale (5–10+) usually drowns the semantic signal — this column exists to make that failure visible, not to recommend it.
  - `buildHybrid` — the same two legs fused by **RRF** (`rank_constant: 60`, `rank_window_size: 50`) instead of raw score — immune to the scale mismatch that breaks Combined.
  - Every builder takes an optional `AreaPreset` (see `lib/geo.ts`) and wraps its query in a `geo_distance` **filter** — geo narrows the candidate pool identically for all 4 columns, it never re-ranks. This keeps the column comparison apples-to-apples even with a location filter active.
- Combined and Hybrid show 2-node per-leg attribution ("KEY #n · SEM #m") computed by `_id` lookup against the keyword/semantic tiers — do not use `explain:true` in the app. The keyword leg used inside Combined/Hybrid is the *exact same* `minimum_should_match` query as column 1, so the "KEY #n" shown is honest, not a different internal definition.
- No model toggle: this is an additive progression, not a compare-two-models demo. (The dropped sparse-vs-dense/cross-lingual story lived in an earlier version of this demo; see git history if reviving it.)
- **Geospatial** (`lib/geo.ts`): coordinates are synthetic — a `REGION_COORDS` centroid per Singapore neighbourhood + deterministic per-doc jitter, injected at seed time in `scripts/seed.ts`'s `onDocument` (none of the 123 hand-authored docs needed real lat/lon added by hand). Four area pills (`AREA_PRESETS`) were each checked against every region's centroid so they partition cleanly with no cross-contamination between "East"/"Central"/"North"/"West" (only the `Newton` region falls in the gap between all four — reachable only via "Anywhere SG", a known/acceptable gap). Distance shown on cards is a plain client-side haversine from the active area's center — cosmetic, doesn't affect ranking.
- **Photos**: every doc in the dataset (all 30 core + all 93 filler) carries a verified `image_url` — a Wikimedia Commons thumbnail whose filename was resolved through the Commons search + imageinfo API and checked for a real `image/*` mime type before being written, never guessed. The 7 filler docs Commons had no reasonable photo for (Fuzhou Oyster Cake, Barley Water, Hainanese Pork Chop, Hotplate Tofu, Muah Chee, Kueh Pie Tee, Min Jiang Kueh) were removed from the dataset entirely rather than shown with a placeholder — confirmed via `scripts/validate-chips.ts` that none of the 5 chip stories depended on them. `ResultCard.tsx`'s `DishThumb` still has a gradient + monogram `onError` fallback as a defensive safety net (e.g. if a Commons URL ever breaks, or new docs are added later without a photo), but nothing in the current dataset triggers it.
- `data/dishes.core.json` = 30 story-critical docs hand-tuned so each suggested-query chip lands (see chip table in docs/PLAN.md, and each doc's `notes` field for which chip it serves — `notes` is stripped before indexing); `data/dishes.extra.json` = 93 filler docs.
- Text fields use the standard analyzer on purpose (no stemming, unigram CJK) — makes lexical failure modes crisp and explainable.
- 5 suggested-query chips, one per teaching point: **exact term** (all 4 columns agree) → **paraphrase** (Keyword and naive Combined both wrongly rank Nasi Lemak over Katong Laksa; RRF fixes it) → **pure concept** (Keyword returns nothing; Semantic/Combined/Hybrid gracefully inherit the semantic read) → **clean win / Hybrid hero** (Keyword and Combined both misrank Curry Chicken Noodles over Mee Rebus; RRF is the only column that matches Semantic's correct read) → **geospatial filter** (same query, same ranking logic, narrowed to the East — far-flung results drop out, genuinely-nearby ones surface).

## UI & branding

- GrabFood-inspired visual redesign (2026-07-11): full-bleed hero banner in brand green (`--color-brand`, `#00b14f`, `app/globals.css`), "Hawker Food" wordmark set in **Baloo 2** (`--font-hero`, loaded in `app/layout.tsx`) — rounded/bold, visually close to the Grab wordmark. `components/HeroCollage.tsx` adds a 2×2 staggered photo collage (Chilli Crab, Hainanese Chicken Rice, Katong Laksa, Chicken Satay — real verified photos already in the dataset) to the right of the hero title, shown at `lg:` breakpoint and up only.
- Copy was deliberately stripped from the UI to cut visual noise: no more eyebrow/tagline text in the header, no tier `tech` subtitle under each column name (e.g. "BM25 multi_match"), no chip `archetype` label (e.g. "paraphrase") above each suggested query. `TierMeta` (`lib/tiers.ts`) no longer has a `tech` field at all. `archetype` still exists on `SuggestedQuery` (`lib/suggested-queries.ts`) — it's read by `scripts/validate-chips.ts` and documented in `docs/PLAN.md`, just not rendered.
- The 4 columns are named for display as **Keyword → Semantic → Keyword + Semantic → Keyword + Semantic + Rank** (`lib/tiers.ts` `TIERS[].name`) — the hero's process stepper reads from the same array, so renaming a tier there updates both places.

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
- [ ] First live Cloud Run deploy + demo runbook walkthrough with Kenneth
