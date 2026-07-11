# Hawker Search

Elastic hybrid-search demo: an additive **Keyword → Semantic → Keyword + Semantic →
+ RRF** progression over a Singapore hawker-food dataset. Full design: [docs/PLAN.md](docs/PLAN.md).
Deploying to production: [docs/DEPLOY.md](docs/DEPLOY.md).

## Requirements

- Node.js 20+ and npm
- An [Elastic Cloud Serverless](https://www.elastic.co/cloud/serverless) project

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the variables below
npm run seed                 # creates the index + loads the dataset
npm run dev                  # http://localhost:3000
```

## Environment variables (`.env.local`)

| Variable | Required | Description |
| --- | --- | --- |
| `ELASTICSEARCH_URL` | yes | Your Elastic Cloud Serverless endpoint |
| `ELASTICSEARCH_API_KEY` | yes | API key with read/write access to the index |
| `ES_INDEX` | no | Index name (default: `hawker-dishes`) |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app locally at :3000 |
| `npm run seed` | Recreate the index and bulk-load `data/*.json` |
| `npm run warm` | Optional connectivity smoke test (semantic search runs on the always-warm Elastic Inference Service, so this isn't required before a demo) |
| `npx tsx scripts/validate-chips.ts` | Acceptance test: confirms every suggested-query chip reproduces its intended result |
| `npm run deploy` | Deploy the latest Docker Hub image to Cloud Run (see [docs/DEPLOY.md](docs/DEPLOY.md)) |
