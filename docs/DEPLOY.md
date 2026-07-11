# Deploy runbook: Docker Hub → GKE

This covers everything needed to go from a git push to a publicly reachable demo on GKE.
Elasticsearch itself is **external** (Elastic Cloud Serverless) — nothing ES-related runs
in the cluster; the app just needs the right env vars at runtime.

## 1. One-time setup

### 1a. Docker Hub access token → GitHub secrets
Create an access token at hub.docker.com → Account Settings → Security, then in the
GitHub repo (Settings → Secrets and variables → Actions) add:

- `DOCKERHUB_USERNAME` = `kennethfoo24`
- `DOCKERHUB_TOKEN` = the access token (not your account password)

That's the only CI secret needed — the workflow (`.github/workflows/docker-publish.yml`)
only builds and pushes; it never touches Elasticsearch or GKE.

### 1b. Local tooling
Install `gcloud`, `kubectl`, and the GKE auth plugin:
```
gcloud components install gke-gcloud-auth-plugin
```

### 1c. Create the GKE cluster (Singapore region, matching the app's target region)
```
gcloud container clusters create-auto hawker-search --region asia-southeast1
gcloud container clusters get-credentials hawker-search --region asia-southeast1
```
(Autopilot keeps node management out of scope; a Standard cluster works too.)

## 2. Seed and warm Elasticsearch (before first use, and before every demo)

These are dev-machine steps against the external serverless project — not part of the
image or the cluster:
```
npm run seed   # once: creates/populates the hawker-dishes index, deploys the e5 model
npm run warm   # ~5 min before every demo: serverless ML scales to zero when idle
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

## 4. Create the in-cluster Elasticsearch secret
Never commit real values — `k8s/secret.example.yaml` is a template only. Create the real
secret from your gitignored `.env.local`:
```
export $(grep -v '^#' .env.local | xargs)
kubectl create secret generic hawker-es \
  --from-literal=ELASTICSEARCH_URL="$ELASTICSEARCH_URL" \
  --from-literal=ELASTICSEARCH_API_KEY="$ELASTICSEARCH_API_KEY"
```

## 5. Deploy
```
kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml
kubectl get pods -w                # wait for both replicas Running/Ready
kubectl get svc hawker-search -w   # wait for EXTERNAL-IP to be assigned
```
Open `http://<EXTERNAL-IP>/` and run through all 5 suggested-query chips.

## 6. Updating the running deployment
After a new image is pushed:
```
kubectl rollout restart deployment/hawker-search
kubectl rollout status deployment/hawker-search
```

## 7. Tear down after the demo (avoid ongoing cost)
A GKE cluster + LoadBalancer bill continuously while they exist:
```
kubectl delete -f k8s/service.yaml -f k8s/deployment.yaml
gcloud container clusters delete hawker-search --region asia-southeast1
```

## Known gaps / things to accept for a demo
- The LoadBalancer serves plain HTTP on a raw IP — no TLS, no domain. Adding HTTPS would
  mean an Ingress + a Google-managed certificate + a domain, which is out of scope here.
- Dish photos are fetched directly by the browser from `upload.wikimedia.org` — confirm
  they render from the public IP (no CDN/proxy involved, so this should just work, but
  verify once after first deploy).
