# owyang.xyz

Jekyll site (Millennial theme) served by GitHub Pages straight from `main`. There is no CI build step: GitHub Pages runs Jekyll itself, so anything that needs Node is built locally and committed.

## /fam (password-protected family trip page)

`owyang.xyz/fam` is a private page for a family trip. It has three modes, deep-linkable as `/fam#eat`, `/fam#shop`, and `/fam#art`.

### How it is protected

GitHub Pages is static, so the password gate is encryption. `npm run fam:build` encrypts the trip data (PBKDF2-SHA256, 600k iterations, AES-256-GCM) and writes `fam.html` holding only ciphertext. The browser decrypts it after the password is entered, then keeps the derived key (never the password) for 30 days.

This repo is public, so:

- `content/fam.json` is the plaintext working copy. It is gitignored and must never be committed. `fam:check` fails if it is tracked.
- `content/fam.json.enc` is the committed, encrypted copy of the same data.
- Never put the password in a file, commit message, or PR. It comes from the `FAM_PAGE_PASSWORD` environment variable. If that variable is missing, stop and ask the user to set it (in a cloud session, as an environment variable in the environment's settings) rather than having them paste it into chat. Don't guess it.
- The password is short, so the encryption keeps out casual visitors, not a determined attacker. Don't add confirmation numbers, phone numbers, or anything else that would matter if it leaked.
- The password is case-insensitive and ignores surrounding spaces (both sides lowercase and trim it).

### Files

| Path | What it is |
| --- | --- |
| `content/fam.json` | Plaintext data, gitignored. Created by `fam:unlock`. |
| `content/fam.json.enc` | Encrypted data. Committed. |
| `fam.html` | Built page, served at `/fam`. Committed. Never edit by hand. |
| `assets/fam/` | Leaflet and the Instrument Sans font, copied in by the build. Committed. |
| `src/fam/` | Page source: `index.html` template, `fam.css`, and the JS modules. |
| `scripts/fam/` | Build and data tooling. `lib/schema.mjs` holds the schema and copy rules. |

`_config.yml` excludes the tooling from Jekyll and keeps `fam.html` out of the sitemap.

### Commands

Run `npm install` first in a fresh checkout.

- `npm run fam:unlock`: decrypt `content/fam.json.enc` into `content/fam.json` for editing. The other commands do this automatically when the plaintext is missing.
- `npm run fam:check`: validate the data. Fails on schema errors, unknown keys, duplicate ids, unknown `group` or `area`, coordinates outside NYC, em dashes anywhere, and banned words or exclamation marks in our copy. Warns on notes over six words.
- `npm run fam:geocode -- "<address>"`: lat/lng from OpenStreetMap Nominatim (no key, 1 request per second). Prints the match so you can confirm it is the right place.
- `npm run fam:diff`: plaintext diff of the data against `HEAD`. Plain `git diff` only shows ciphertext.
- `npm run fam:build`: check, encrypt, and write `fam.html`, `content/fam.json.enc`, and `assets/fam/`. Fails without writing anything if the data is invalid or the password doesn't match. Rebuilding unchanged data leaves the files untouched.
- `npm run fam:build -- --rekey`: change the password. Signs every device out.

### Workflow: adding, changing, or removing a place

Prompts look like "Add Dominique Ansel to eat, Sat 3pm, party of 6", "Add Sézane on Elizabeth St to boutiques", "Add a 'Gifts' group to shop", or "Remove <place>".

1. **Identify the mode and the group or area.** Eat entries need a date and time. Shop entries need a `group` from `config.shopGroups`. Galleries need an `area` from `config.artAreas`. If the prompt doesn't make it clear, ask one question.
2. **Get the address.** If the user didn't give one, look it up. If two locations are plausible (chains, multiple branches), ask which.
3. **Get coordinates** with `npm run fam:geocode -- "<address>"`, and check that the printed match is the right place. If Nominatim is unreachable (cloud sessions may block `nominatim.openstreetmap.org`), say so and leave `lat`/`lng` out. The place is still listed, just not on the map. Never guess coordinates.
4. **Fill in fields.**
   - `placeId`, `hours`, `website`, and `shows` are optional. Include them only if the user provided them or you verified them.
   - Never guess hours. Leave `hours` out and the page shows "Check hours". `null` for a day means closed.
   - `id` is a lowercase slug, unique across the whole file (e.g. `dominique-ansel`).
5. **Write the note**: six words or fewer, factual (e.g. "Japanese denim and clothing"). Follow the copy rules below.
6. **Run `npm run fam:check`**, then show the user `npm run fam:diff`.
7. **Leave everything else alone.** Don't change layout, ordering logic, or other entries while adding a place. Ordering is automatic.

Then run `npm run fam:build` and commit `content/fam.json.enc` and `fam.html` together (never `content/fam.json`).

Adding a shop group or art area is a one-line change to `config`. Chips, headings, and maps pick it up automatically. Give a new shop group a `pin` from the preset list (`solid`, `outline`, `square-outline`, `diamond`, `square`) that no other group uses. A group (a filter chip with its own pins) is different from `tags` (small labels on one item, like "For Mom"). If a new group should take over existing places, ask before moving them.

Removing a place means deleting its entry. Nothing else references place ids.

### Data conventions

- Dates `YYYY-MM-DD`, times 24h `HH:MM`, all in New York time (`config.timezone`). The page shows "Fri, Oct 2" and "5:00pm".
- Hours are keyed `fri` / `sat` / `sun` as `"12:00-19:00"` (shown as "12-7pm"). `null` means closed. A missing day or missing `hours` means unknown.
- Eat: `id, date, time, name, address, neighborhood`, optional `party, lat, lng, placeId`.
- Shop: `id, group, name, address, neighborhood`, optional `note, tags, hours, hoursNote, website, lat, lng, placeId`.
- Galleries: `id, area, name, address`, optional `note, shows [{artist, title?, through}], hours, hoursNote, website, neighborhood, lat, lng, placeId`. Shows whose `through` date has passed are hidden automatically.
- Events: `id, name, address, dates [{date, hours?}]`, optional `note, neighborhood, url, ticketUrl, mapPdf, lat, lng, placeId`.

### Copy rules

- Display headings are lowercase via CSS. Keep the data in normal case.
- Notes are factual descriptors, six words or fewer.
- No marketing language: hidden gem, must-see, must-visit, iconic, curated, vibes, perfect, don't miss, or exclamation marks. Proper nouns (names, show titles) are exempt.
- No em dashes anywhere.
- No descriptions, tips, or commentary beyond what the user gave.

### Design rules (when changing the page itself)

- UI colors are `#000` and `#fff` only. Color comes only from the map tiles.
- One choreographed animation: the mode-switch pulse (about 600ms, instant with reduced motion). Other interactions stay under 200ms. No looping animation.
- Pill buttons with 1px black outlines, 1px rules between rows, no shadows or gradients, tap targets at least 44px, works at 360px wide.
- Avoid all-caps labels, eyebrow labels, middle-dot separators, arrows on links, and numbered markers.
