import { useState } from 'react';
import { downloadCsv, handsToCsv } from '../lib/csv';
import { drawBatch } from '../lib/simulator';
import type { Card, DrawnHand } from '../lib/types';
import StatsPanel from './StatsPanel';

export default function BatchMode({
  library,
  keepableMin,
  keepableMax,
}: {
  library: Card[];
  keepableMin: number;
  keepableMax: number;
}) {
  const [count, setCount] = useState(100);
  const [hands, setHands] = useState<DrawnHand[]>([]);

  function draw(n: number) {
    const clamped = Math.max(1, Math.min(10000, Math.floor(n) || 0));
    setCount(clamped);
    setHands(drawBatch(library, clamped).map((cards) => ({ cards, mulligans: 0 })));
  }

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(handsToCsv(hands, keepableMin, keepableMax), `goldfish-batch-${stamp}.csv`);
  }

  return (
    <section className="panel">
      <h2>Batch test</h2>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <input
          type="number"
          min={1}
          max={10000}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          aria-label="Number of hands"
        />
        <button type="button" className="primary" onClick={() => draw(count)}>
          Draw {count || '?'} hands
        </button>
        {[10, 100, 1000].map((n) => (
          <button key={n} type="button" onClick={() => draw(n)}>
            {n}
          </button>
        ))}
        {hands.length > 0 && (
          <button type="button" onClick={exportCsv}>
            Export CSV
          </button>
        )}
      </div>
      {hands.length === 0 ? (
        <p className="muted small">
          Draw a batch of independent 7-card hands to measure the deck's
          consistency.
        </p>
      ) : (
        <StatsPanel hands={hands} keepableMin={keepableMin} keepableMax={keepableMax} />
      )}
    </section>
  );
}
