import { useEffect, useMemo, useState } from 'react';
import BatchMode from './components/BatchMode';
import DeckInput, { type LoadedDeck } from './components/DeckInput';
import { CardChip } from './components/HandView';
import KeepableSettings from './components/KeepableSettings';
import SingleMode from './components/SingleMode';
import StatsPanel from './components/StatsPanel';
import { classifyTypeLine } from './lib/classify';
import { downloadCsv, handsToCsv } from './lib/csv';
import { normalizeName } from './lib/scryfall';
import { DEFAULT_KEEPABLE } from './lib/stats';
import type { Card, DrawnHand, KeepableConfig } from './lib/types';

const KEEPABLE_STORAGE_KEY = 'goldfish-keepable-v1';

function loadKeepable(): KeepableConfig {
  try {
    const stored = localStorage.getItem(KEEPABLE_STORAGE_KEY);
    if (!stored) return DEFAULT_KEEPABLE;
    return { ...DEFAULT_KEEPABLE, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_KEEPABLE;
  }
}

function App() {
  const [deck, setDeck] = useState<LoadedDeck | null>(null);
  const [commanderName, setCommanderName] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [keepable, setKeepable] = useState<KeepableConfig>(loadKeepable);
  const [session, setSession] = useState<DrawnHand[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(KEEPABLE_STORAGE_KEY, JSON.stringify(keepable));
    } catch {
      // Not persisted — settings still work for this session.
    }
  }, [keepable]);

  const toCard = useMemo(() => {
    const cardData = deck?.cards;
    return (name: string): Card => {
      const data = cardData?.get(normalizeName(name));
      return {
        name,
        oracleName: data?.oracleName || name,
        typeLine: data?.typeLine ?? null,
        primaryType: classifyTypeLine(data?.typeLine ?? null),
        producedMana: data?.producedMana ?? [],
        manaValue: data?.manaValue ?? null,
        manaCost: data?.manaCost ?? null,
        colorIdentity: data?.colorIdentity ?? [],
      };
    };
  }, [deck]);

  function handleLoaded(loaded: LoadedDeck) {
    setDeck(loaded);
    setSession([]);
    if (loaded.parsed.commander) {
      setCommanderName(loaded.parsed.commander);
    } else {
      // Best guess: first legendary creature in the list, else first legend.
      const names = [...new Set(loaded.parsed.library)];
      const typeOf = (n: string) => loaded.cards.get(normalizeName(n))?.typeLine ?? '';
      const guess =
        names.find((n) => /Legendary.*Creature/.test(typeOf(n))) ??
        names.find((n) => typeOf(n).includes('Legendary')) ??
        null;
      setCommanderName(guess);
    }
  }

  // If the commander was picked from the pasted 100, pull one copy out of
  // the library so hands draw from the 99.
  const library: Card[] = useMemo(() => {
    if (!deck) return [];
    let names = deck.parsed.library;
    if (!deck.parsed.commander && commanderName) {
      const i = names.indexOf(commanderName);
      if (i >= 0) names = [...names.slice(0, i), ...names.slice(i + 1)];
    }
    return names.map(toCard);
  }, [deck, commanderName, toCard]);

  const commanderPickable = deck !== null && !deck.parsed.commander;
  const uniqueNames = useMemo(
    () => (deck ? [...new Set(deck.parsed.library)] : []),
    [deck],
  );

  function exportSession() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(handsToCsv(session, keepable), `goldfish-session-${stamp}.csv`);
  }

  return (
    <>
      <h1>Commander Goldfish</h1>
      <p className="tagline">
        Paste your deck, draw opening hands, and see how consistent it really is.
      </p>

      <section className="panel">
        <h2>Deck</h2>
        <DeckInput onLoaded={handleLoaded} hasDeck={deck !== null} />
        {deck && (
          <>
            <div className="deck-summary" style={{ marginTop: 12 }}>
              {commanderName && (
                <>
                  <span className="muted small">Command zone:</span>
                  <CardChip card={toCard(commanderName)} />
                </>
              )}
              <span className="chip">{library.length} cards in library</span>
            </div>
            {commanderPickable && (
              <div className="btn-row">
                <label className="small muted" htmlFor="commander-select">
                  Commander (not marked in the paste — pick it):
                </label>
                <select
                  id="commander-select"
                  value={commanderName ?? ''}
                  onChange={(e) => setCommanderName(e.target.value || null)}
                >
                  <option value="">— none / test all 100 —</option>
                  {uniqueNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {deck.parsed.warnings.map((w) => (
              <p key={w} className="warning small">
                ⚠ {w}
              </p>
            ))}
            {deck.notFound.length > 0 && (
              <p className="warning small">
                ⚠ Not found on Scryfall (counted as Unknown type):{' '}
                {deck.notFound.join(', ')}
              </p>
            )}
            {deck.parsed.skippedLines.length > 0 && (
              <p className="muted small">
                Skipped {deck.parsed.skippedLines.length} unparseable line
                {deck.parsed.skippedLines.length > 1 ? 's' : ''}:{' '}
                {deck.parsed.skippedLines.slice(0, 5).join(' · ')}
                {deck.parsed.skippedLines.length > 5 && ' · …'}
              </p>
            )}
          </>
        )}
      </section>

      {deck && library.length >= 7 && (
        <>
          <KeepableSettings config={keepable} onChange={setKeepable} />

          <div className="tabs">
            <button
              type="button"
              className={mode === 'single' ? 'active' : ''}
              onClick={() => setMode('single')}
            >
              Single hands
            </button>
            <button
              type="button"
              className={mode === 'batch' ? 'active' : ''}
              onClick={() => setMode('batch')}
            >
              Batch test
            </button>
          </div>

          {mode === 'single' ? (
            <>
              <SingleMode
                library={library}
                config={keepable}
                onKeep={(hand) => setSession((s) => [...s, hand])}
              />
              {session.length > 0 && (
                <section className="panel">
                  <h2>Session log — kept hands</h2>
                  <div className="btn-row" style={{ marginTop: 0 }}>
                    <button type="button" onClick={exportSession}>
                      Export CSV
                    </button>
                    <button type="button" onClick={() => setSession([])}>
                      Clear log
                    </button>
                  </div>
                  <StatsPanel hands={session} config={keepable} showMulligans />
                </section>
              )}
            </>
          ) : (
            <BatchMode library={library} config={keepable} />
          )}
        </>
      )}
    </>
  );
}

export default App;
