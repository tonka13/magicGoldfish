export const CARD_TYPES = [
  'Land',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Unknown',
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export interface Card {
  name: string;
  typeLine: string | null;
  primaryType: CardType;
}

export interface ParsedDeck {
  /** Commander card name if the paste marked one, else null. */
  commander: string | null;
  /** Library entries expanded by quantity (commander excluded). */
  library: string[];
  /** Lines that could not be parsed as cards and were skipped. */
  skippedLines: string[];
  warnings: string[];
}

export interface DrawnHand {
  cards: Card[];
  /** Mulligans taken before this hand was kept (0 for batch hands). */
  mulligans: number;
}

export interface HandAnalysis {
  landCount: number;
  typeCounts: Record<CardType, number>;
  keepable: boolean;
}

export interface BatchStats {
  handCount: number;
  avgLands: number;
  keepablePct: number;
  keepableMin: number;
  keepableMax: number;
  avgTypeCounts: Record<CardType, number>;
  /** Index = number of lands in hand (0..7). */
  landDistribution: number[];
}
