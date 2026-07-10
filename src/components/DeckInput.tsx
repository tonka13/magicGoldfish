import { useState } from 'react';
import { parseDecklist } from '../lib/parser';
import { resolveCards, type CardData } from '../lib/scryfall';
import { SAMPLE_DECK } from '../lib/sampleDeck';
import type { ParsedDeck } from '../lib/types';

export interface LoadedDeck {
  parsed: ParsedDeck;
  cards: Map<string, CardData>;
  notFound: string[];
}

export default function DeckInput({
  onLoaded,
  hasDeck,
}: {
  onLoaded: (deck: LoadedDeck) => void;
  hasDeck: boolean;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(source: string) {
    setError(null);
    const parsed = parseDecklist(source);
    if (parsed.library.length === 0 && !parsed.commander) {
      setError('No cards found — paste a decklist like "1 Sol Ring" per line.');
      return;
    }
    setBusy(true);
    setProgress('Looking up card types on Scryfall…');
    try {
      const names = [...parsed.library];
      if (parsed.commander) names.push(parsed.commander);
      const { cards, notFound } = await resolveCards(names, (done, total) =>
        setProgress(`Looking up card types… ${done}/${total}`),
      );
      onLoaded({ parsed, cards, notFound });
      setOpen(false);
    } catch (err) {
      setError(
        `Card lookup failed (${err instanceof Error ? err.message : String(err)}). ` +
          'Check your internet connection and try again.',
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  if (!open) {
    return (
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" onClick={() => setOpen(true)}>
          Edit / change deck
        </button>
      </div>
    );
  }

  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          'Paste your decklist, one card per line:\n\nCommander: Goreclaw, Terror of Qal Sisma\n1 Sol Ring\n1 Command Tower (C21) 263\n30 Forest\n…'
        }
        aria-label="Decklist"
      />
      <div className="btn-row">
        <button type="button" className="primary" disabled={busy} onClick={() => load(text)}>
          {busy ? 'Loading…' : 'Load deck'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setText(SAMPLE_DECK);
            load(SAMPLE_DECK);
          }}
        >
          Load sample deck
        </button>
        {hasDeck && (
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
        {progress && <span className="muted small">{progress}</span>}
      </div>
      {error && <p className="warning small">{error}</p>}
    </>
  );
}
