# Hawker Search — 4-Tier Relevance Demo

Customer-facing Elastic demo: side-by-side comparison of **BM25 → semantic → naive hybrid → hybrid via RRF** over a multilingual Singapore hawker-food dataset, with a sparse (ELSER) ⇄ dense (multilingual-e5) model toggle to showcase cross-lingual retrieval. Full design: [docs/PLAN.md](docs/PLAN.md).

## Stack & infra

- Next.js 15 (App Router, TS), Tailwind v4, `@elastic/elasticsearch` v9
- Elasticsearch = **Elastic Cloud Serverless** (RRF + default inference endpoints `.elser-2-elasticsearch` / `.multilingual-e5-small-elasticsearch` included out of the box)
- Env (`.env.local`, never committed): `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, optional `ES_INDEX` (default `hawker-dishes`)
- Deploy target (Phase B only): Docker → Google Cloud Run, `asia-southeast1`

## Commands

- `npm run dev` — local demo at :3000
- `npm run seed` — recreate index + bulk ingest `data/*.json` (first run auto-deploys both ML models; budget 5–10 min)
- `npm run warm` — one semantic query per model; run ~5 min before any live demo (ML scales to zero when idle)

## Architecture notes

- `lib/queries.ts` holds the 4 query builders — the heart of the demo. All use the retriever framework; `match` on `semantic_text` fields is the recommended semantic query.
- Naive hybrid (tier 3) is a deliberate anti-pattern: raw `bool/should` score addition showing scale mismatch (ELSER ~10–20 swamps BM25; e5 ~1 gets swamped).
- RRF tier shows per-leg attribution ("lex #n · sem #m") computed by `_id` lookup against tiers 1–2 — do not use `explain:true` in the app.
- `data/dishes.core.json` = ~30 story-critical docs hand-tuned so each suggested-query chip lands (see chip table in docs/PLAN.md); `data/dishes.extra.json` = ~100 filler docs. **Wording restrictions in descriptions: never use the literal phrases "noodle soup", "banana leaf", "coconut milk" except in the deliberate lexical-distractor docs (nasi lemak, bak chor mee, thosai, banana leaf rice).**
- Text fields use the standard analyzer on purpose (no stemming, unigram CJK) — makes lexical failure modes crisp and explainable.

## Current state (2026-07-07)

- [x] Scaffold, deps, git init
- [ ] Dataset: core docs (in progress), extra docs (background agent writing `data/dishes.extra.json`)
- [ ] lib/ (es client, types, queries, chips) + seed/warm scripts
- [ ] Seed against serverless project (needs user's `.env.local` credentials)
- [ ] Relevance validation: all 8 chips × both models via curl; tune until each chip tells its story
- [ ] API route + UI (4 columns, chips, model toggle, cross-column hover)
- [ ] Local review checkpoint with Kenneth → then Phase B (Docker/Cloud Run)
