import type { CardType } from './types';

/**
 * Priority order for cards with multiple types. Land first because land
 * count is the metric goldfishing cares about (a creature land is a land
 * drop); creature next so artifact/enchantment creatures count as bodies.
 */
const PRIORITY: CardType[] = [
  'Land',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
];

/** Classify a Scryfall type_line into a single primary type. */
export function classifyTypeLine(typeLine: string | null): CardType {
  if (!typeLine) return 'Unknown';
  // For double-faced cards only the front face determines what's in hand.
  const front = typeLine.split('//')[0];
  for (const type of PRIORITY) {
    if (front.includes(type)) return type;
  }
  return 'Unknown';
}

export function emptyTypeCounts(): Record<CardType, number> {
  return {
    Land: 0,
    Creature: 0,
    Planeswalker: 0,
    Battle: 0,
    Instant: 0,
    Sorcery: 0,
    Artifact: 0,
    Enchantment: 0,
    Unknown: 0,
  };
}
