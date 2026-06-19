---
name: new-amp-post
description: >-
  Create a new wernull.com blog post about a tube-amp build. Use when the user
  wants to write or draft an amp post, has uploaded build photos to
  source/assets/images/fullsize/<N>/, or shares notes about an amp to turn into
  a post. Guides scanning and selecting the photos, placing the hero/OG image,
  interviewing the user to fill narrative gaps, and drafting in the blog's house
  style (modeled on the #12 amp post).
---

# New amp blog post (wernull.com)

Turn a pile of build photos + rough notes into a finished amp post that matches
the voice and structure of the existing posts. The canonical model is
[#12 — Lab Surplus AC4](../../../source/_posts/2019-04-14-amp-12.markdown);
**read it first every time** — it defines the house style and image layout.

## What the user provides

- An **amp number** `N` (the build's number, e.g. `12`).
- A **pile of notes** about the build (pasted, in a file, or spoken across the chat).
- **Photos already uploaded** to `source/assets/images/fullsize/N/`.

If the amp number isn't stated, ask for it before doing anything else.

## Workflow

1. **Orient** — read the model post + the user's notes, list the uploads.
2. **Select & place images** — view, *propose picks and wait for approval*, then apply file ops.
3. **Interview** — ask as many targeted questions as it takes to fill the story.
4. **Draft** — write the post in the house style.
5. **Refine** — iterate with the user.
6. **Preview & deploy** — `docker compose up`, then `bash deploy.sh`.

---

## Step 1 — Orient

- Read `source/_posts/2019-04-14-amp-12.markdown` to re-internalize structure and voice.
- Read all of the user's notes for this build.
- List `source/assets/images/fullsize/N/` to see what was uploaded (ignore `.DS_Store`).

## Step 2 — Select & place the images

**This step is propose-then-approve. Do NOT rename, copy, move, or delete any
file until the user approves the plan.**

1. **View the uploads.** Read the image files in `source/assets/images/fullsize/N/`
   so you can actually judge them. They can be large (2–4 MB each, 20+ files) —
   read them in batches of ~5–8. You must see a photo to select it.

2. **Categorize** what's there, mapping to the post's sections (see the model post):
   - **Hero / completed-amp beauty shots** — front-angle, straight-on front, back.
   - **Schematic** (if photographed/drawn).
   - **Donor gear / upcycled parts.**
   - **Transformer / power.**
   - **Cabinet / chassis / faceplate / metalwork** (in-progress and finished).
   - **Wiring / internals.**
   - **Detail shots** — badges, knobs, tubes glowing.
   Drop blurry, redundant, or weak frames; when several show the same thing, keep the best one or two.

3. **Pick the hero.** Choose the single best shot of the *completed* amp. It becomes
   the social/OG image **and** the home-page thumbnail, so it must be sharp and flattering.

4. **Propose the plan and stop.** Present:
   - The hero shot.
   - The full selection, grouped by post section, each with a proposed descriptive
     filename `ampN-<descriptor>.jpg` (e.g. `amp12-front-angle.jpg`,
     `amp12-donor-board.jpg`, `amp12-tubes-glow.jpg`). Use a numeric suffix when two
     similar shots are both kept (`...-donor-unit-2.jpg`).
   - The list of files that will be **deleted** (everything not selected).
   - Wait for explicit approval. Adjust if the user changes picks.

5. **Apply (only after approval).** Use the shell:
   - **Rename** each chosen file to its `ampN-<descriptor>.jpg` name, in place, inside
     `source/assets/images/fullsize/N/`.
   - **Place the hero** for social/OG: `mkdir -p source/images/N` and copy the renamed
     hero file there under the **same filename**
     (`source/images/N/ampN-<descriptor>.jpg`).
   - **Delete** the unselected files from `source/assets/images/fullsize/N/`.

   End state: `source/assets/images/fullsize/N/` holds only the chosen, renamed shots,
   and `source/images/N/` holds the one hero file.

## Step 3 — Interview

The notes will be incomplete. Generate **as many questions as needed** to tell the
full story, asked in topical batches. Use the model post to see what a complete
story covers. Typical gaps to probe:

- **Build name / theme** — every build has a story (e.g. *Oscillator Redemption*). What's the angle this time? Any callback to a previous build?
- **Circuit / model** it's based on (Vox AC4, Fender Tweed 5E5, Princeton 5B2, …).
- **Build/completion date** — drives the post date and filename; it's historical, not today.
- **Tube lineup** — specific brand/type per position (preamp, PI, rectifier, output).
- **Controls / features** — volume, tone, tremolo, effects loop, etc.
- **Donor gear / upcycled parts** — what was reused, and where it came from.
- **Transformer(s) / power.**
- **Cabinet / chassis / faceplate** — materials, techniques (dovetails, metalwork, powder coat, decals), finish.
- **Wiring / layout** — what was hard, what went wrong or right, what you improved over last time.
- **Speaker** (if any).
- **Sound / result** — how it actually turned out.
- **TONE3000 capture URL** (optional) and **YouTube demo URL** (optional).
- **Home-page placement** — should it be `featured`? See the `feature_order` procedure below.

### Home-page placement: suggest a `feature_order`

The home page lists `featured: true` posts by `feature_order` ascending (1 = top);
posts with no `feature_order` fall back to date order *after* the numbered ones.
The post date is the **build date** (often years old), so don't lean on the date
tiebreak — prefer an explicit number.

Gather the current state, then propose a slot:

```bash
grep -E '^(title|date|featured|feature_order):' source/_posts/*.markdown
```

Reconstruct today's featured order from that, then recommend a value:
- **Top of the page** (default for a new, proud build): `feature_order: 1`, and offer to
  bump the current 1, 2, … each up by one so nothing ties.
- **A specific slot K:** `feature_order: K`, and offer to shift posts currently at ≥ K up by one.
- **Bottom of the featured list:** `feature_order: <current max + 1>`.
- **Not prominently featured:** omit `feature_order` (date fallback), or omit `featured` entirely.

Present the recommended number **and** any renumbering of *other* posts, then get
approval before editing those files (same propose-then-approve rule as the images).

## Step 4 — Draft the post

Create `source/_posts/<build-date>-amp-N.markdown` (e.g. `2019-04-14-amp-12.markdown`).

### Frontmatter

```yaml
---
layout: post
title: "#N - <Build Name> <Model>"     # e.g. "#12 - Lab Surplus AC4"
date: <build date> 20:00:00 -0500       # build/completion date, not today
categories: amps                        # or: tech
image: https://wernull.com/images/N/ampN-<hero>.jpg   # absolute URL, the hero file
featured: true                          # optional — shows on the home page
feature_order: 1                        # optional — lower = higher; see Step 3 to pick the slot
tone3000: https://www.tone3000.com/...  # optional — adds the TONE3000 button/badge
description: "1–3 sentence blurb."       # required-in-practice: this is the social card
                                         #   AND the home-page description. Make it strong.
---
```

Notes:
- `image` and `description` both render on the home page and in social cards — they sell the post.
- Do **not** add `<!--more-->`; no post uses it.
- `comments: true` and `no_header: true` exist but are rarely used; only add if asked.

### Body structure (mirror the model post)

Images use the `picture` tag, path relative to `assets/images/fullsize`:
`{% picture thumbnail N/ampN-<descriptor>.jpg %}`. Float a single image with
`class="left"`, and close a floated section with `<div style="clear: both;"></div>`.

1. **Hero gallery** — three thumbnails of the finished amp (front-angle, front, back).
2. **Intro / hook** — the story. Name the build in *italics*. Lead with what made this one personal.
3. **Circuit** — `{% picture thumbnail N/ampN-schematic.jpg class="left" %}` then the tube lineup and controls; end with `<div style="clear: both;"></div>`.
4. **Donor / upcycled parts** — the sourcing story + a gallery of donor shots.
5. **Transformer / power** — a `class="left"` image + a short paragraph; clear the float.
6. **Cabinet / faceplate / metalwork** — the fabrication story + a gallery.
7. **Wiring / internals** — what you cleaned up or learned + a gallery.
8. **Closing** — how it sounds and whether the theme paid off.
9. **Optional demo** — a centered YouTube embed:

```html
<div style="clear: both;"></div>
<div style="text-align:center; margin:0 auto 1.5em;">
<iframe width="315" height="560" style="max-width:100%;" src="https://www.youtube.com/embed/VIDEO_ID" title="Wernull #N <Name> — demo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</div>
```

### Voice

First person, humble, story-driven, specific (name the actual parts/brands), casual
but knowledgeable. It reads like a maker telling a friend how the build went —
including the frustrations and the wins. Match the model post's rhythm.

## Step 5 — Refine

Show the draft, take edits, iterate. Re-check image picks against the final narrative —
add or swap a shot if a section needs one.

## Step 6 — Preview & deploy

- **Preview:** `docker compose up` → http://localhost:4000 (live reload). The
  `picture` tags generate responsive images at build time via `jekyll_picture_tag`,
  which shells out to the `vips` CLI (`libvips-tools` is already in the Dockerfile).
- **Deploy (only when the user asks):** `bash deploy.sh` — builds in Docker with
  `JEKYLL_ENV=production`, syncs `public/` to S3, and invalidates CloudFront.
- Commit only if the user asks.

---

## Quick reference

- **Uploads / gallery images:** `source/assets/images/fullsize/N/ampN-<descriptor>.jpg`,
  referenced as `{% picture thumbnail N/ampN-<descriptor>.jpg %}`.
- **Hero / OG image:** copy of the best finished shot at
  `source/images/N/ampN-<hero>.jpg`, set as `image:` with the absolute
  `https://wernull.com/...` URL.
- **Post file:** `source/_posts/<build-date>-amp-N.markdown`.
- **Title pattern:** `#N - <Build Name> <Model>`.
- **Date:** the build/completion date, not the day you're writing.
- **Don't** use `<!--more-->`. **Do** write a strong `description` (it's the home-page + social blurb).
