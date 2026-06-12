# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog at [wernull.com](https://wernull.com) — tube amplifiers and tech by Kyle Werner. Built with Jekyll 4, hosted on AWS S3 + CloudFront.

## Commands

```bash
# Dev server (http://localhost:4000)
bundle exec jekyll serve

# Production build (outputs to public/)
JEKYLL_ENV=production bundle exec jekyll build

# Create a new post
rake new_post['Post Title']

# Deploy (build → S3 sync → CloudFront invalidation)
bash deploy.sh
```

## Architecture

- **Source**: `source/` → **Output**: `public/` (gitignored)
- **Posts**: `source/_posts/YYYY-MM-DD-slug.markdown` with YAML frontmatter
- **Layouts**: `source/_layouts/` — `default.html`, `post.html`, `page.html`
- **Includes**: `source/_includes/` — `article.html` is the core post renderer; `post/` subdirectory has date, sharing, etc.
- **Styles**: `source/_sass/` with subdirs `base/`, `custom/`, `partials/`, `plugins/`; compiled via `source/stylesheets/screen.scss`
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
---
```

Use `<!--more-->` as the excerpt separator. Posts support `{% picture %}` for responsive images and `{% video_tag %}` for embedded video.

## Deploy Details

`deploy.sh` requires AWS CLI configured with profile `wernull`. It syncs to `s3://wernull.com` and invalidates two CloudFront distributions. The `image` frontmatter field is used as the OG/social share image and should be an absolute URL.
