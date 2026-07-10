import { producersCounted } from '../lib/mana';
import { summarizeBatch, analyzeHand } from '../lib/stats';
import { CARD_TYPES } from '../lib/types';
import type { DrawnHand, KeepableConfig } from '../lib/types';
import { TYPE_COLOR_VAR } from './HandView';
import Histogram from './Histogram';

/** Summary tiles + histogram + per-hand table for a set of drawn hands. */
export default function StatsPanel({
  hands,
  config,
  showMulligans,
}: {
  hands: DrawnHand[];
  config: KeepableConfig;
  showMulligans?: boolean;
}) {
  if (hands.length === 0) return null;

  const cardLists = hands.map((h) => h.cards);
  const stats = summarizeBatch(cardLists, config);
  const types = CARD_TYPES.filter((t) => stats.avgTypeCounts[t] > 0);
  const withProducers = producersCounted(config);

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <span className="label">Hands drawn</span>
          <div className="value">{stats.handCount.toLocaleString()}</div>
        </div>
        <div className="tile">
          <span className="label">Average lands per hand</span>
          <div className="value">{stats.avgLands.toFixed(2)}</div>
        </div>
        {withProducers && (
          <div className="tile">
            <span className="label">Average mana sources</span>
            <div className="value">{stats.avgManaSources.toFixed(2)}</div>
          </div>
        )}
        <div className="tile">
          <span className="label">Keepable hands</span>
          <div className="value">{stats.keepablePct.toFixed(1)}%</div>
        </div>
      </div>

      <Histogram distribution={stats.landDistribution} config={config} />

      <p className="histogram-title">Average cards per hand by type</p>
      <div className="breakdown">
        {types.map((type) => (
          <span
            key={type}
            className="entry"
            style={{ '--type-color': TYPE_COLOR_VAR[type] } as React.CSSProperties}
          >
            <span className="dot" aria-hidden />
            {type}: {stats.avgTypeCounts[type].toFixed(2)}
          </span>
        ))}
      </div>

      <p className="histogram-title">Hands</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th className="num">Lands</th>
              {withProducers && <th className="num">Sources</th>}
              {showMulligans && <th className="num">Mulls</th>}
              <th>Keep?</th>
              <th>Cards</th>
            </tr>
          </thead>
          <tbody>
            {hands.map((hand, i) => {
              const a = analyzeHand(hand.cards, config);
              return (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td className="num">{a.landCount}</td>
                  {withProducers && <td className="num">{a.manaSources}</td>}
                  {showMulligans && <td className="num">{hand.mulligans}</td>}
                  <td>{a.keepable ? '✓' : '—'}</td>
                  <td className="cards-cell">
                    {hand.cards.map((c) => c.name).join(', ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
