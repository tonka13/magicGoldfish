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

export function CardChip({
  card,
  selected,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
}) {
  const style = { '--type-color': TYPE_COLOR_VAR[card.primaryType] } as React.CSSProperties;
  const className = `card-chip${selected ? ' selected' : ''}`;
  // Flavor-named prints (e.g. "Aang's Shelter") show their real card.
  const alias = normalizeName(card.name) !== normalizeName(card.oracleName);
  const body = (
    <>
      <span className="card-name">
        {card.name}
        {alias && <span className="alias"> = {card.oracleName}</span>}
      </span>
      <span className="card-type">{card.primaryType}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={className} style={style} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={className} style={style}>
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
  selectedIndices,
  onToggleCard,
}: {
  cards: Card[];
  selectedIndices?: Set<number>;
  onToggleCard?: (index: number) => void;
}) {
  return (
    <>
      <div className="hand-grid">
        {cards.map((card, i) => (
          <CardChip
            key={i}
            card={card}
            selected={selectedIndices?.has(i)}
            onClick={onToggleCard ? () => onToggleCard(i) : undefined}
          />
        ))}
      </div>
      <TypeBreakdown cards={cards} />
    </>
  );
}
