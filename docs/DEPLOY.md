# Deploy runbook: Docker Hub → Cloud Run

This covers everything needed to go from a git push to a publicly reachable demo on Cloud
Run. Elasticsearch itself is **external** (Elastic Cloud Serverless) — nothing ES-related
runs in Cloud Run; the container just needs the right env vars at runtime.

## 1. One-time setup

### 1a. Docker Hub access token → GitHub secrets
Create an access token at hub.docker.com → Account Settings → Security, then in the
GitHub repo (Settings → Secrets and variables → Actions) add:

- `DOCKERHUB_USERNAME` = `kennethfoo24`
- `DOCKERHUB_TOKEN` = the access token (not your account password)

That's the only CI secret needed — the workflow (`.github/workflows/docker-publish.yml`)
only builds and pushes; it never touches GCP.

### 1b. Local tooling
Install the `gcloud` CLI and authenticate:
```
gcloud auth login
gcloud config set project <your-gcp-project-id>
```

## 2. Seed Elasticsearch (before first use)

Dev-machine step against the external serverless project — not part of the image or the
Cloud Run service. Semantic embeddings run on the Elastic Inference Service (EIS), which
is shared and always-warm, so this completes in seconds with no model deploy to wait on:
```
npm run seed   # once: creates/populates the hawker-dishes index
npm run warm   # optional connectivity smoke test — not required, EIS has no cold start
npx tsx scripts/validate-chips.ts   # optional: confirms all 5 chip stories still work
```

## 3. Build & push the image
Push to `main` (or run the workflow manually via Actions → Build and Push Docker Image →
Run workflow). Confirm the new tag lands at
https://hub.docker.com/r/kennethfoo24/elastic-hawker-search/tags

To smoke-test the Dockerfile locally first:
```
docker build -t hawker-search:test .
docker run --rm -p 8080:8080 --env-file .env.local hawker-search:test
# open http://localhost:8080
```

## 4. Deploy to Cloud Run
```
npm run deploy
```
This runs `scripts/deploy-cloud-run.sh`, which:
- reads `ELASTICSEARCH_URL` / `ELASTICSEARCH_API_KEY` / `ES_INDEX` from `.env.local`
- pushes the API key into **Secret Manager** (`hawker-es-api-key`) and grants the Cloud
  Run runtime service account `secretAccessor` — the key is never passed as a plain
  `--set-env-vars` value, which would otherwise sit in plaintext in the revision config
- deploys `kennethfoo24/elastic-hawker-search:latest` to the Cloud Run service
  `hawker-search` in `asia-southeast1`, publicly accessible (`--allow-unauthenticated`)

Equivalent manual command, if you'd rather not use the script (per `docs/PLAN.md`):
```
gcloud run deploy hawker-search --image=docker.io/kennethfoo24/elastic-hawker-search:latest \
  --region=asia-southeast1 --allow-unauthenticated --port=8080 \
  --set-env-vars=ES_INDEX=hawker-dishes,ELASTICSEARCH_URL=... \
  --set-secrets=ELASTICSEARCH_API_KEY=hawker-es-api-key:latest
```

The command prints the public service URL on success — open it and run through all 5
suggested-query chips.

## 5. Updating the running deployment
Re-run `npm run deploy` (or the manual command above) after a new image is pushed —
`gcloud run deploy` always creates a new revision from the given image tag and shifts
traffic to it.

## 6. Tear down after the demo (avoid ongoing cost)
```
gcloud run services delete hawker-search --region=asia-southeast1
gcloud secrets delete hawker-es-api-key
```

## Known gaps / things to accept for a demo
- Cloud Run's default `*.run.app` URL is HTTPS out of the box, so no TLS setup is needed
  (unlike the earlier GKE plan, which would have needed an Ingress + managed cert for
  HTTPS). A custom domain is optional and out of scope here.
- Dish photos are fetched directly by the browser from `upload.wikimedia.org` — confirm
  they render from the Cloud Run URL (no CDN/proxy involved, so this should just work,
  but verify once after first deploy).
- Cold start: Cloud Run scales to zero by default when idle — the first request after
  idle time may be slow (the Elasticsearch side no longer has this problem now that
  `semantic_e5` runs on EIS, but the Cloud Run container itself still does). Set
  `--min-instances=1` on the service if you want to avoid this for a live demo (costs
  more to keep warm).
