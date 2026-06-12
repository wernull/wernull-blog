#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Build project (in Docker)"
# Production build runs in the container so it uses the same Ruby/libvips
# toolchain as local dev. Output is written to ./public on the host via the
# bind mount, where the AWS CLI below can read it.
docker compose run --rm -e JEKYLL_ENV=production jekyll bundle exec jekyll build

echo "Sync to S3"
# AWS CLI runs on the host using the local `wernull` profile/credentials.
aws s3 sync ./public s3://wernull.com --profile wernull

echo "Clear cloudfront cache"
aws cloudfront create-invalidation --distribution-id E166S0HG6YKT5Q --paths "/*" --profile wernull
aws cloudfront create-invalidation --distribution-id E2NQH92HXEFZCN --paths "/*" --profile wernull

echo "Deploy Complete"
