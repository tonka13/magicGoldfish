import type { Card, CardType } from '../lib/types';
import { CARD_TYPES } from '../lib/types';
import { emptyTypeCounts } from '../lib/classify';
import { normalizeName } from '../lib/scryfall';

export const TYPE_COLOR_VAR: Record<CardType, string> = {
  Land: 'var(--t-land)',
  Creature: 'var(--t-creature)',
  Planeswalker: 'var(--t-planeswalker)',
  Battle: 'var(--t-battle)',
  Instant: 'var(--t-instant)',
  Sorcery: 'var(--t-sorcery)',
  Artifact: 'var(--t-artifact)',
  Enchantment: 'var(--t-enchantment)',
  Unknown: 'var(--t-unknown)',
};

/**
 * One card as its real Scryfall image (placeholder frame when unresolved).
 * `index` staggers the deal-in animation; `selected` marks it for bottoming.
 */
export function GameCard({
  card,
  index = 0,
  selected,
  onClick,
}: {
  card: Card;
  index?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  // Flavor-named prints (e.g. "Aang's Shelter") note their real card.
  const alias = normalizeName(card.name) !== normalizeName(card.oracleName);
  const face = card.imageUrl ? (
    <img
      className="mcard-img"
      src={card.imageUrl}
      alt={card.name}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span
      className="mcard-fallback"
      style={{ '--type-color': TYPE_COLOR_VAR[card.primaryType] } as React.CSSProperties}
    >
      <span className="card-name">{card.name}</span>
      <span className="card-type">{card.primaryType}</span>
    </span>
  );
  const className = `mcard${selected ? ' selected' : ''}`;
  const style = { '--i': index } as React.CSSProperties;
  const body = (
    <>
      {face}
      {selected && <span className="bottom-badge">Bottom</span>}
      {alias && <span className="mcard-alias">= {card.oracleName}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={className} style={style} title={card.name} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={className} style={style} title={card.name}>
      {body}
    </div>
  );
}

export function TypeBreakdown({ cards }: { cards: Card[] }) {
  const counts = emptyTypeCounts();
  for (const card of cards) counts[card.primaryType]++;
  const entries = CARD_TYPES.filter((t) => counts[t] > 0);
  return (
    <div className="breakdown">
      {entries.map((type) => (
        <span
          key={type}
          className="entry"
          style={{ '--type-color': TYPE_COLOR_VAR[type] } as React.CSSProperties}
        >
          <span className="dot" aria-hidden />
          {counts[type]} {counts[type] === 1 ? type : type === 'Sorcery' ? 'Sorceries' : `${type}s`}
        </span>
      ))}
    </div>
  );
}

export default function HandView({
  cards,
  dealKey,
  selectedIndices,
  onToggleCard,
}: {
  cards: Card[];
  /** Change to replay the deal-in animation (fresh draw / mulligan). */
  dealKey?: number;
  selectedIndices?: Set<number>;
  onToggleCard?: (index: number) => void;
}) {
  return (
    <>
      <div className="hand-row" key={dealKey}>
        {cards.map((card, i) => (
          <GameCard
            key={i}
            card={card}
            index={i}
            selected={selectedIndices?.has(i)}
            onClick={onToggleCard ? () => onToggleCard(i) : undefined}
          />
        ))}
      </div>
      <TypeBreakdown cards={cards} />
    </>
  );
}
