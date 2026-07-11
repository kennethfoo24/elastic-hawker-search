#!/usr/bin/env bash
# Deploy the Docker Hub image to Cloud Run. Reads ELASTICSEARCH_URL /
# ELASTICSEARCH_API_KEY / ES_INDEX from .env.local, same as seed/warm.
#
# The API key is pushed into Secret Manager (never passed as a plain
# --set-env-vars value, which would sit in plaintext in the revision config)
# and mounted via --set-secrets. ELASTICSEARCH_URL / ES_INDEX are not
# sensitive in the same way and stay as plain env vars.
#
# Usage: npm run deploy   (or: bash scripts/deploy-cloud-run.sh)
# Override defaults via env: SERVICE, REGION, IMAGE, SECRET_NAME, e.g.
#   REGION=us-central1 npm run deploy
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${ELASTICSEARCH_URL:?Set ELASTICSEARCH_URL in .env.local}"
: "${ELASTICSEARCH_API_KEY:?Set ELASTICSEARCH_API_KEY in .env.local}"

SERVICE="${SERVICE:-hawker-search}"
REGION="${REGION:-asia-southeast1}"
IMAGE="${IMAGE:-docker.io/kennethfoo24/elastic-hawker-search:latest}"
ES_INDEX="${ES_INDEX:-hawker-dishes}"
SECRET_NAME="${SECRET_NAME:-hawker-es-api-key}"

PROJECT="$(gcloud config get-value project)"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Syncing $SECRET_NAME in Secret Manager (project: $PROJECT)..."
if gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  printf '%s' "$ELASTICSEARCH_API_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=-
else
  printf '%s' "$ELASTICSEARCH_API_KEY" | gcloud secrets create "$SECRET_NAME" --data-file=- --replication-policy=automatic
fi

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None >/dev/null

echo "Deploying $IMAGE to Cloud Run service '$SERVICE' in $REGION..."

gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="ES_INDEX=${ES_INDEX},ELASTICSEARCH_URL=${ELASTICSEARCH_URL}" \
  --set-secrets="ELASTICSEARCH_API_KEY=${SECRET_NAME}:latest"
