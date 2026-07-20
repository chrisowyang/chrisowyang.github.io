# owyang.xyz

Personal site for Chris Owyang. Hand-built — no theme, no framework, no
build tooling beyond Jekyll (which GitHub Pages runs automatically on push
to the default branch, keeping the current owyang.xyz host and CNAME).

## Editing content (no layout code required)

| What | File |
|---|---|
| Story chapters (the homepage timeline) | `_data/chapters.yml` |
| "Now" block (items + date stamp) | `_data/now.yml` |
| Writing pieces | `_writing/*.md` (front matter: `title`, `dek`, `date`, `draft`) |
| About page | `pages/about.md` |
| Email / LinkedIn / hero description | `_config.yml` |

Set `draft: true` on a writing piece to show a "working notes" label;
remove it when a piece is finished.

## Design decisions (documented per the PRD)

- **Accent color:** a muted Williams College purple (`#533a7d`) — drawn
  from Chris's world (where the arc starts) rather than a default palette.
  Everything else is warm paper (`#fbfaf7`) and warm ink (`#262119`).
- **The through-line** is the only decorative element: one continuous
  SVG path (`assets/js/throughline.js`) rebuilt to pass through each
  chapter's marker, drawn in on scroll. Static under
  `prefers-reduced-motion` and without JavaScript.
- **Type:** Newsreader (self-hosted woff2, `assets/fonts/`) for display;
  Charter/Georgia system serif for body; system sans for meta labels.
  Sentence case throughout.
- **Hosting:** kept on GitHub Pages (PRD open question 1 — zero-migration
  default; merging to the default branch deploys).

## Local preview

```sh
bundle install
bundle exec jekyll serve
```

## Before final polish (Chris's checklist, from the PRD)

- [ ] Rewrite the DRAFT chapter copy in `_data/chapters.yml` (marked at the top of the file)
- [ ] Approve or replace the hero sentence (`index.html`, marked DRAFT)
- [ ] Add 1–2 real photos + non-work texture to `pages/about.md` (TODOs inline)
- [ ] Replace the seeded writing drafts in `_writing/` (each marked DRAFT in a comment)
- [ ] Confirm LinkedIn URL in `_config.yml` (commented out until confirmed)
- [ ] v1.1, later: "Ask my site" chat behind a feature flag
