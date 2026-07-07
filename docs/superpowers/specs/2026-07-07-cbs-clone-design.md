# Clues by Sam Clone — Design

**Date:** 2026-07-07
**Status:** Approved pending user review

## Purpose

A personal archive and player for Clues by Sam daily puzzles, hosted on GitHub
Pages at an obscure UUID path. A GitHub Action scrapes each day's puzzle into a
common JSON format; historical puzzles can be imported manually by URL or
puzzleId. The clone implements the core gameplay including the signature
"no guessing" enforcement.

This is a personal-use archival project. The puzzles are commercial content
from cluesbysam.com (Ad Artis Oy). The site carries `noindex`, lives behind an
unguessable path, and is not promoted or monetized. Note: on a free GitHub
plan the repo must be public for Pages, so puzzle JSON is world-readable in
the repo regardless of the UUID path.

## Scope

**v1 (this project):**
- Card grid gameplay: tap → choose Criminal/Innocent → flip, reveal clue
- No-guessing enforcement via the puzzle's embedded deduction `paths`
- Clue rendering with name/profession highlighting from markup tokens
- Archive page listing all stored puzzles with per-puzzle progress
- Progress persistence in localStorage (resume across sessions)
- Daily scraper Action + manual import (Actions UI and local CLI)

**Anticipated later (design leaves room, no v1 work):**
- Corner color tags, two-level hint system, settings, result sharing

**Out of scope:** accounts, server-side anything, stats, share images,
inspect mode, puzzle authoring.

## Background: how the source site works

cluesbysam.com serves a static page regenerated daily. The full puzzle —
including answers — is embedded in the day's JS bundle (`assets/index-<hash>.js`)
as an array of person objects:

```js
nv=4,av=5,uv="Medium",iv="The criminals have a new hobby",cv=[{criminal:!1,
profession:"coder",name:"banda",gender:"male",
orig_hint:"number_of_traits_in_unit(unit(between,pair(7,11)),innocent,1)",
paths:[[9,4,17,13,15,11,18,10,8,19,1,16]],
hint:"There is only one innocent #BETWEEN:pair(7,11)"},…]
```

Adjacent constants: the date as a `"YYYY-MM-DD"` string, and the puzzleId as a
12-hex-char string next to the `https://cluesbysam.com/log` endpoint constant.
Guess validation is fully client-side; network calls are telemetry only.
Archived puzzles are served at `https://cluesbysam.com/s/play?puzzleId=<id>`
with the same embedding.

## Architecture

Stack: **Vite + React + TypeScript** for the site; **Node (TS) scripts** for
extraction; **GitHub Actions** for scraping, importing, and Pages deployment.

```
cbs2/
├── .github/workflows/
│   ├── scrape-daily.yml     # cron 3×/day: extractor vs homepage, commit if new
│   ├── import-puzzle.yml    # workflow_dispatch: url_or_id (+ date_override)
│   └── deploy.yml           # workflow_call + push: vite build + puzzles/ → Pages
├── scripts/
│   ├── extract.mts          # page → bundle → normalized puzzle JSON
│   └── manifest.mts         # regenerate puzzles/index.json
├── puzzles/
│   ├── index.json           # manifest: [{date, id, difficulty, title}]
│   └── YYYY-MM-DD.json      # one file per puzzle
└── site/                    # Vite + React + TS app
```

### Deployment & obscurity

Official Pages artifact flow (`upload-pages-artifact` → `deploy-pages`). The
artifact is assembled as:

- `/index.html` — blank page at the site root
- `/<UUID>/` — the built app (Vite `base` set to `/cbs2/<UUID>/`)
- `/<UUID>/puzzles/` — copied from `puzzles/`

The UUID lives in exactly one config file read by both the Vite config and the
deploy workflow. Every page includes `<meta name="robots" content="noindex">`.
Playable link: `https://<user>.github.io/cbs2/<UUID>/`.

**Workflow-trigger gotcha:** commits pushed with the default `GITHUB_TOKEN` do
not trigger `push` workflows. Therefore `deploy.yml` is a reusable workflow
(`on: workflow_call`) invoked by scrape and import workflows after they commit,
and it also has `on: push` (main) for human commits. No PAT required.

## Puzzle JSON format

One file per puzzle at `puzzles/<date>.json`:

```json
{
  "formatVersion": 1,
  "id": "a6f09e2713b2",
  "date": "2026-07-07",
  "title": "The criminals have a new hobby",
  "difficulty": "Medium",
  "width": 4,
  "height": 5,
  "source": "cluesbysam.com",
  "people": [
    {
      "name": "banda",
      "profession": "coder",
      "gender": "male",
      "criminal": false,
      "clue": "There is only one innocent #BETWEEN:pair(7,11)",
      "origHint": "number_of_traits_in_unit(unit(between,pair(7,11)),innocent,1)",
      "paths": [[9, 4, 17, 13, 15, 11, 18, 10, 8, 19, 1, 16]]
    }
  ]
}
```

- `people` is in grid order: A1, B1, C1, D1, A2, … (row-major), length = width×height.
- `clue`, `origHint`, `paths` are nullable — not every card carries a clue.
- `clue` keeps raw markup tokens (`#BETWEEN:pair(7,11)` etc.); rendering is the
  UI's job. Unknown tokens render as plain text.
- Emoji faces are not source data; the UI derives them from profession+gender
  via a mapping table with a generic-face fallback.
- `origHint` (machine-readable clue DSL) is stored unused in v1 to enable
  future tooling.
- `puzzles/index.json` is generated, never hand-edited:
  `[{ "date", "id", "difficulty", "title" }]` sorted by date descending.

## Extractor (`scripts/extract.mts`)

Input: full URL, bare puzzleId (expanded to
`https://cluesbysam.com/s/play?puzzleId=<id>`), or nothing (today's homepage).

1. Fetch page HTML; find `<script type="module" src="assets/index-*.js">`;
   resolve the bundle URL relative to the page (hash changes per build — always
   discovered, never hardcoded).
2. Fetch bundle; locate the array via its stable signature `[{criminal:`;
   bracket-match to the closing `]`; evaluate the slice in a `node:vm` sandbox.
3. Metadata via regexes anchored to stable content, not minified names:
   - width/height/difficulty/title: `…=(\d+),…=(\d+),…="…",…="…",…=[{criminal:`
     immediately preceding the array
   - date: the `"\d{4}-\d{2}-\d{2}"` string constant
   - puzzleId: the 12-hex-char constant adjacent to the `/log` URL constant
4. Normalize, validate (person count = width×height, required fields, date
   shape), write `puzzles/<date>.json`.
5. Idempotency: existing file with same puzzle id → exit 0 ("already have
   it"); existing file with different content → hard fail, never overwrite.
6. Regenerate the manifest.

Manual imports: archived pages are expected to embed their original date; the
`date_override` workflow input covers cases where they don't.

## Workflows

- **scrape-daily.yml** — cron at 00:40, 06:40, and 12:40 UTC (source rollover
  timezone unknown; idempotent runs make exact timing irrelevant). Checkout →
  run extractor → commit & push if changed → call deploy.
- **import-puzzle.yml** — `workflow_dispatch` inputs `url_or_id` (required),
  `date_override` (optional). Same steps. The extractor is equally runnable
  locally: `node scripts/extract.mts <url-or-id>`.
- **deploy.yml** — `workflow_call` + `push` (main). Vite build, assemble
  artifact (blank root + app and puzzles under UUID path), deploy to Pages.
- Concurrency groups prevent overlapping scrape runs and overlapping deploys.

## Game UI

Hash routing, no router library: `#/` archive, `#/play/<date>` game.

- **Archive:** reads `index.json`; lists puzzles grouped by month with
  difficulty and status (unplayed / in progress / done) from localStorage.
- **Game:** responsive card grid. Unflipped card: emoji face, name, profession.
  Tap → Criminal/Innocent choice. Correct → card flips, colored verdict, clue
  revealed. Wrong choice on a deducible card → recorded mistake, no flip.
  Non-deducible card → blocked (no-guessing rule).
- **Clue rendering:** `ClueText` component tokenizes markup, highlights
  referenced names/professions, plain-text fallback for unknown tokens.
- **Persistence:** per-puzzle localStorage keyed by puzzle id: flips, mistakes,
  elapsed time. Resume across sessions.
- **Components:** `App` → `Archive` | `Game` → `Grid` → `Card`, plus
  `ClueText` and a `useGameState` reducer hook owning all game logic. Future
  features (tags, hints, settings) land in the reducer + small UI additions
  without restructuring.

### No-guessing enforcement (known risk)

Enforcement is driven by the embedded `paths` data. Its exact semantics are
not yet reverse-engineered (it appears to be precomputed deducibility
orderings). Implementation step one is confirming how the original bundle
consumes it. **Fallback if semantics resist recovery:** ship without
hard-blocking — wrong flips are still recorded as mistakes and surfaced, and
enforcement is added in a later iteration. The reducer isolates this decision
behind a single `isDeducible(state, index)` function.

## Error handling

- Extractor: distinct, loud failures per stage (page fetch / bundle discovery /
  array parse / metadata parse / schema validation) so upstream site changes
  surface as clear Actions failure emails, not bad data. Never overwrites
  differing content.
- UI: puzzle fetch failure → error screen with retry; unknown clue tokens →
  plain text; corrupt localStorage entry → reset that puzzle's progress only.

## Testing (Vitest)

- Extractor: fixture-based tests against a checked-in trimmed real bundle
  slice (bundle discovery, array extraction, metadata regexes, normalization).
- Schema validation tests (good and malformed inputs).
- `useGameState` reducer tests: flip, mistake, enforcement/`isDeducible`,
  completion detection, localStorage round-trip.
- Component tests stay light; logic lives in the reducer.

## Decisions log

- Fidelity: core mechanics + no-guessing; tags/hints/settings anticipated later.
- Import inputs: puzzle URL / puzzleId only (no saved-file or hand-written paths).
- Import triggers: Actions UI (workflow_dispatch) + same script as local CLI.
- Stack: Vite + React + TS (user choice over no-build vanilla).
- Obscurity: UUID path + blank root + noindex; accepts public-repo visibility.
