# Commander Goldfish

Web app for goldfishing a Magic: The Gathering Commander deck — paste a
decklist, draw sample opening hands, test London mulligans, and measure how
consistently the deck delivers keepable hands.

**Live app:** https://tonka13.github.io/magicGoldfish/ (auto-deployed from
`main` by GitHub Actions)

## Run locally

```
npm install
npm run dev      # then open http://localhost:5173
```

Card types are looked up on the [Scryfall API](https://scryfall.com/docs/api)
the first time a deck is loaded (internet required once per card; results are
cached in localStorage).

## Features

- **Messy-paste-tolerant parser** — handles `1 Sol Ring`, `1x Sol Ring`, bare
  names, set codes / collector numbers / foil markers, blank lines, comments,
  and section headers. Commander via `Commander:` prefix, `*CMDR*` tag, a
  `Commander` section, or a picker if unmarked.
- **Universes Beyond flavor names** — pasting a UB alias (e.g. "Aang's
  Shelter") resolves to the real card (Teferi's Protection) via Scryfall's
  `/cards/named` fallback, and the hand display shows the equivalence.
- **Single hands** — draw from the 99, London mulligan (fresh 7 each time,
  bottom N on keep), optional free-first-mulligan house rule. Kept hands
  accumulate in a session log.
- **Batch test** — draw N hands at once; average lands, average mana sources,
  keepable-%, average type breakdown, land-count histogram, and a per-hand
  table.
- **Configurable keepable definition** — default: 3+ mana sources, 2–4 lands.
  Mana dorks (creatures that produce mana) and mana rocks (artifacts that
  produce mana) can count as sources, detected from Scryfall's
  `produced_mana` with a mana-value cap (default ≤3) so late-game producers
  don't count as early ramp. All knobs adjustable and persisted in
  localStorage.
- **Color-aware curve check** (on by default) — a keepable hand must also be
  able to *cast* an early curve with its actual colors: lands on turns 1–2, a
  spell payable off those two lands' produced colors by turn 2 (real pip
  matching, e.g. `{W}{R}` vs what your lands tap for — hybrid and Phyrexian
  handled), and a turn-3 play with 3 mana, or 4 when the turn-2 play was a
  dork/rock. A WR hand holding only white spells with no white source fails.
- **CSV export** — per-hand card lists and stats plus summary rows, for both
  the batch and the session log.

## Tests

```
npm test           # offline unit tests (parser, stats, simulator)
npm run test:live  # integration test against the real Scryfall API
```

## Structure

Game/analysis logic is framework-free TypeScript in `src/lib/` (parser,
Scryfall client, classifier, simulator, stats, CSV) so it can port to a future
mobile app (React Native / Capacitor / PWA); React components in
`src/components/` are a thin UI layer on top.
