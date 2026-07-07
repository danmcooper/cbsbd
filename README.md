# cbs2

Personal archive and player for Clues by Sam daily puzzles. See
`docs/superpowers/specs/2026-07-07-cbs-clone-design.md` for the design.

## Commands

- `npm run dev` — dev server (open the printed URL; the app lives under the UUID base path)
- `npm test` — full Vitest suite
- `npm run build` — production build to `site/dist/`
- `npm run extract` — scrape today's puzzle into `puzzles/`
- `npm run extract -- <url-or-puzzleId>` — import a specific/archived puzzle
  (`DATE_OVERRIDE=YYYY-MM-DD` env var if the page has no date)
- `npm run manifest` — regenerate `puzzles/index.json`

## One-time repo setup

1. Repo Settings → Pages → Source: **GitHub Actions**.
2. `config/site.json` holds the site UUID — generated once, never regenerate.

Playable link: `https://<user>.github.io/cbs2/<UUID>/`
