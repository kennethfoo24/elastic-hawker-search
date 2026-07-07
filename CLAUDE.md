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
- [x] Dataset: 130 docs (`dishes.core.json` 30 story-critical + `dishes.extra.json` 100 filler)
- [x] lib/ (es client, types, queries, chips) + seed/warm/validate-chips scripts
- [x] Seeded against Kenneth's serverless project (Azure southeastasia, `.env.local`)
- [x] Relevance validated & tuned: `npx tsx scripts/validate-chips.ts` — every chip's story reproduces
  - Chip 5 ("halal chicken noodle soup in Bedok") is the flagship: RRF #1 = Mee Soto under BOTH models while lexical top-ranks chicken chop / pork bak chor mee
  - Chips 7/8 (zh/ta) are the sparse-vs-dense punchline: ELSER noise → flip to e5 → cross-lingual hit
  - RRF is honest, not magic: on pure-paraphrase chips a doc present in both legs can outrank the semantic hero — that's why chip 5 (both legs carry signal) is the RRF chip
- [x] API route + UI complete, verified in browser via Playwright
- [ ] Local review checkpoint with Kenneth → then Phase B (Dockerfile, Cloud Run deploy, README runbook)
