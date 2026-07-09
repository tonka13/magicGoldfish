# Commander Goldfish

Web app for goldfishing a Magic: The Gathering Commander deck — paste a
decklist, draw sample opening hands, test London mulligans, and measure how
consistently the deck delivers keepable hands.

## Run

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
- **Single hands** — draw from the 99, London mulligan (fresh 7 each time,
  bottom N on keep), optional free-first-mulligan house rule. Kept hands
  accumulate in a session log.
- **Batch test** — draw N hands at once; average lands, keepable-% (land range
  configurable, default 3–5), average type breakdown, land-count histogram,
  and a per-hand table.
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
