import { useState } from 'react';
import {
  bottomCards,
  drawHand,
  effectiveMulligans,
} from '../lib/simulator';
import { producersCounted } from '../lib/mana';
import { analyzeHand } from '../lib/stats';
import type { Card, DrawnHand, KeepableConfig } from '../lib/types';
import HandView from './HandView';

type Phase = 'idle' | 'deciding' | 'bottoming' | 'kept';

export default function SingleMode({
  library,
  config,
  onKeep,
}: {
  library: Card[];
  config: KeepableConfig;
  onKeep: (hand: DrawnHand) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [hand, setHand] = useState<Card[]>([]);
  const [mulligans, setMulligans] = useState(0);
  const [freeFirst, setFreeFirst] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toBottom = effectiveMulligans(mulligans, freeFirst);

  function newHand() {
    setHand(drawHand(library));
    setMulligans(0);
    setSelected(new Set());
    setPhase('deciding');
  }

  function mulligan() {
    setHand(drawHand(library));
    setMulligans((m) => m + 1);
    setSelected(new Set());
    setPhase('deciding');
  }

  function keep() {
    if (toBottom === 0) {
      finish(hand);
    } else {
      setSelected(new Set());
      setPhase('bottoming');
    }
  }

  function finish(kept: Card[]) {
    setHand(kept);
    setPhase('kept');
    onKeep({ cards: kept, mulligans });
  }

  function toggleCard(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else if (next.size < toBottom) next.add(index);
      return next;
    });
  }

  const analysis = hand.length ? analyzeHand(hand, config) : null;
  const withProducers = producersCounted(config);

  return (
    <section className="panel">
      <h2>Opening hand</h2>
      <div className="settings-row">
        <label>
          <input
            type="checkbox"
            checked={freeFirst}
            onChange={(e) => setFreeFirst(e.target.checked)}
          />
          Free first mulligan (house rule)
        </label>
      </div>

      <div className="btn-row">
        <button type="button" className="primary" onClick={newHand}>
          {phase === 'idle' ? 'Draw opening hand' : 'New hand'}
        </button>
        {phase === 'deciding' && (
          <>
            <button type="button" onClick={mulligan}>
              Mulligan
            </button>
            <button type="button" onClick={keep}>
              Keep
            </button>
          </>
        )}
        {mulligans > 0 && phase !== 'idle' && (
          <span className="muted small">
            Mulligan #{mulligans}
            {phase === 'deciding' && toBottom > 0 && ` — keeping means bottoming ${toBottom}`}
            {phase === 'deciding' && toBottom === 0 && ' — free, keep all 7'}
          </span>
        )}
      </div>

      {phase === 'bottoming' && (
        <p className="mull-banner">
          London mulligan: tap {toBottom} card{toBottom > 1 ? 's' : ''} to put on
          the bottom of your library ({selected.size}/{toBottom} selected).{' '}
          <button
            type="button"
            className="primary"
            disabled={selected.size !== toBottom}
            onClick={() => finish(bottomCards({ hand, mulligans, freeFirst, toBottom }, [...selected]))}
          >
            Bottom {toBottom} &amp; keep
          </button>
        </p>
      )}

      {phase !== 'idle' && hand.length > 0 && (
        <>
          <HandView
            cards={hand}
            selectedIndices={phase === 'bottoming' ? selected : undefined}
            onToggleCard={phase === 'bottoming' ? toggleCard : undefined}
          />
          {analysis && phase !== 'bottoming' && (
            <p className="small">
              {analysis.landCount} land{analysis.landCount !== 1 ? 's' : ''}
              {withProducers &&
                analysis.manaSources !== analysis.landCount &&
                ` + ${analysis.manaSources - analysis.landCount} dork/rock = ${analysis.manaSources} mana sources`}{' '}
              —{' '}
              {analysis.keepable ? (
                <span className="status-good">keepable by your definition</span>
              ) : (
                <span className="warning">
                  not keepable
                  {analysis.manaOk && config.requireCurve && !analysis.curvesOut
                    ? " — can't cast a turn 1–3 curve with these colors"
                    : ' by your definition'}
                </span>
              )}
              {phase === 'kept' && ' · hand kept and added to the session log'}
            </p>
          )}
        </>
      )}
      {phase === 'idle' && (
        <p className="muted small">
          Draw a hand, then keep it or take London mulligans. Kept hands are
          recorded in the session log below for CSV export.
        </p>
      )}
    </section>
  );
}
