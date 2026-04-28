#!/bin/bash
set -e

REGISTRY="us-east1-docker.pkg.dev"
PROJECT="walkthrough-3bd02"
REPO="walkthrough"
IMAGE="walkthrough-backend"
TAG="${1:-latest}"
FULL_IMAGE="${REGISTRY}/${PROJECT}/${REPO}/${IMAGE}:${TAG}"
GCP_ACCOUNT="sofia.el.wong@gmail.com"

echo "Building ${FULL_IMAGE} for linux/amd64..."
docker build --platform linux/amd64 -t "${FULL_IMAGE}" ./backend

echo "Pushing to Artifact Registry..."
gcloud config set account "${GCP_ACCOUNT}"
docker push "${FULL_IMAGE}"
gcloud config set account sofia@herondata.io

echo "Done: ${FULL_IMAGE}"
