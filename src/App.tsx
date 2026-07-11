import { useEffect, useMemo, useState } from 'react';
import BatchMode from './components/BatchMode';
import DeckInput, { type LoadedDeck } from './components/DeckInput';
import KeepableSettings from './components/KeepableSettings';
import SingleMode from './components/SingleMode';
import StatsPanel from './components/StatsPanel';
import { classifyTypeLine } from './lib/classify';
import { downloadCsv, handsToCsv } from './lib/csv';
import { offColorCards } from './lib/legality';
import { normalizeName } from './lib/scryfall';
import { DEFAULT_KEEPABLE } from './lib/stats';
import { DEFAULT_THEME, deckTheme, pipColor } from './lib/theme';
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
  // Bumped per deck load — keys the mode components so they reset fully.
  const [deckSeq, setDeckSeq] = useState(0);
  // Off-color warning list expanded (long lists collapse to a summary).
  const [showOffColor, setShowOffColor] = useState(false);

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
        imageUrl: data?.imageUrl ?? null,
      };
    };
  }, [deck]);

  function handleLoaded(loaded: LoadedDeck) {
    setDeck(loaded);
    setSession([]);
    setDeckSeq((n) => n + 1);
    setShowOffColor(false);
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

  const commander = commanderName ? toCard(commanderName) : null;

  // Color-identity legality: cards in the 99 outside the commander's colors.
  // Called out as a warning only — testing the deck still works.
  const offColor =
    commander && commander.typeLine !== null ? offColorCards(library, commander) : [];

  const theme = useMemo(() => {
    if (!deck) return DEFAULT_THEME;
    return deckTheme(commander ? [...library, commander] : library);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, library, commanderName]);

  const themeStyle = {
    '--accent-l': theme.accentLight,
    '--accent-d': theme.accentDark,
    '--accent-soft-l': theme.softLight,
    '--accent-soft-d': theme.softDark,
    '--identity-gradient': theme.gradient,
  } as React.CSSProperties;

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
    <div className="app" style={themeStyle}>
      <div className="shell">
        <header className="app-header">
          <h1>
            Commander <span className="accent-text">Goldfish</span>
          </h1>
          <p className="tagline">
            Paste your deck, draw opening hands, and see how consistent it really is.
          </p>
        </header>
        <div className="gradient-rule" aria-hidden />

        <section className="panel">
          <h2>Deck</h2>
          <DeckInput onLoaded={handleLoaded} hasDeck={deck !== null} />
          {deck && (
            <>
              <div className="cmd-zone">
                {commander?.imageUrl && (
                  <img
                    className="cmd-img"
                    src={commander.imageUrl}
                    alt={commander.name}
                  />
                )}
                <div>
                  {commander ? (
                    <>
                      <span className="cmd-label">Command zone</span>
                      <div className="cmd-name">{commander.name}</div>
                    </>
                  ) : (
                    <div className="cmd-name muted">No commander marked</div>
                  )}
                  <div className="deck-summary">
                    {commander && commander.colorIdentity.length > 0 && (
                      <span
                        className="mana-pips"
                        title={`Commander color identity: ${commander.colorIdentity.join('')}`}
                      >
                        {commander.colorIdentity.map((c) => (
                          <span
                            key={c}
                            className="pip"
                            style={{ background: pipColor(c) }}
                          />
                        ))}
                      </span>
                    )}
                    <span className="chip">{library.length} cards in library</span>
                  </div>
                </div>
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
              {offColor.length > 0 && (
                <p className="warning small">
                  ⚠ {offColor.length} card{offColor.length > 1 ? 's' : ''} outside{' '}
                  {commander!.name}'s color identity (
                  {commander!.colorIdentity.join('') || 'colorless'})
                  {offColor.length <= 5 || showOffColor ? (
                    <>
                      :{' '}
                      {offColor
                        .map((c) => `${c.name} (${c.colorIdentity.join('')})`)
                        .join(', ')}
                      {offColor.length > 5 && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => setShowOffColor(false)}
                          >
                            hide
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      .{' '}
                      <button
                        type="button"
                        className="linklike"
                        onClick={() => setShowOffColor(true)}
                      >
                        Show all {offColor.length}
                      </button>
                    </>
                  )}
                </p>
              )}
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
          <div className="app-main">
            <aside className="sidebar">
              <KeepableSettings config={keepable} onChange={setKeepable} />
            </aside>
            <div className="content">
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
                    key={deckSeq}
                    library={library}
                    config={keepable}
                    onKeep={(hand) => setSession((s) => [...s, hand])}
                  />
                  {session.length > 0 && (
                    <section className="panel">
                      <h2>Session log</h2>
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
                <BatchMode key={deckSeq} library={library} config={keepable} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
