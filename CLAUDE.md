# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog at [wernull.com](https://wernull.com) — tube amplifiers and tech by Kyle Werner. Built with Jekyll 4, hosted on AWS S3 + CloudFront.

## Commands

Local development runs in **Docker** (see `Dockerfile` / `docker-compose.yml`).
The container carries Ruby 3.1 + libvips so the host needs no native toolchain.

```bash
# Dev server (http://localhost:4000, live-reload on)
docker compose up
docker compose up --build      # rebuild image after changing the Gemfile

# Production build (outputs to public/ on the host)
docker compose run --rm -e JEKYLL_ENV=production jekyll bundle exec jekyll build

# Create a new post
docker compose run --rm jekyll rake new_post['Post Title']

# Deploy (Docker build → S3 sync → CloudFront invalidation)
bash deploy.sh
```

Any `jekyll`/`rake`/`bundle` command runs in the container via
`docker compose run --rm jekyll <cmd>`. The project is bind-mounted, so file
edits reload live; gems live in the image (rebuild after Gemfile changes).
`Gemfile.lock` carries Linux platforms so bundler resolves inside the container.

## Architecture

- **Source**: `source/` → **Output**: `public/` (gitignored)
- **Posts**: `source/_posts/YYYY-MM-DD-slug.markdown` with YAML frontmatter
- **Layouts**: `source/_layouts/` — `default.html`, `post.html`, `page.html`
- **Includes**: `source/_includes/` — `article.html` is the core post renderer; `post/` subdirectory has date, sharing, etc.
- **Styles**: The served stylesheet is a committed, pre-compiled static file at `source/stylesheets/screen.css` (edit it directly for style changes). The `source/_sass/` SCSS tree is Compass-based Octopress and is **not** compiled by the current toolchain — treat it as legacy/reference, not the source of truth.
- **Custom plugins**: `source/_plugins/` — Ruby plugins for `image_tag`, `video_tag`, `blockquote`, `titlecase`, `config_tag`, `include_array`, `raw`
- **Responsive images**: Configured via `source/_data/picture.yml`; use `{% picture %}` tag in posts

## Post Frontmatter

```yaml
---
layout: post
title: "Post Title"
date: 2025-01-15 20:00:00 -0500
categories: amps   # or: tech
image: https://wernull.com/images/16/filename.jpg
comments: true     # optional, enables Disqus
no_header: true    # optional, hides header image
featured: true     # optional, shows on the home page featured list
feature_order: 1   # optional, lower = higher on the home page; ties/unset fall back to date
---
```

Use `<!--more-->` as the excerpt separator. Posts support `{% picture %}` for responsive images and `{% video_tag %}` for embedded video.

The home page (`source/index.html`) lists posts with `featured: true`, sorted by `feature_order` ascending; posts with the same `feature_order` or none set fall back to date (newest first).

## Deploy Details

`deploy.sh` builds the site in Docker (`JEKYLL_ENV=production`), then uses the host AWS CLI (profile `wernull`) to sync `public/` to `s3://wernull.com` and invalidate two CloudFront distributions. AWS credentials stay on the host and never enter the container. The `image` frontmatter field is used as the OG/social share image and should be an absolute URL.
