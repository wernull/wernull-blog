#!/bin/bash
echo "Build project"
JEKYLL_ENV=production bundle exec jekyll build
echo "Sync to S3"
aws s3 sync $HOME/documents/github/wernull-blog/public s3://wernull.com --profile wernull
echo "Clear cloudfront cache"
aws cloudfront create-invalidation --distribution-id E166S0HG6YKT5Q --paths "/*" --profile wernull
aws cloudfront create-invalidation --distribution-id E2NQH92HXEFZCN --paths "/*" --profile wernull
echo "Deploy Complete"
