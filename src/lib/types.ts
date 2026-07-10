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
  /** Name as pasted in the decklist (may be a flavor name, e.g. "Aang's Shelter"). */
  name: string;
  /** Real Oracle name (e.g. "Teferi's Protection" for its UB flavor prints). */
  oracleName: string;
  typeLine: string | null;
  primaryType: CardType;
  /** Mana symbols this card can produce (Scryfall produced_mana), e.g. ['G']. */
  producedMana: string[];
  manaValue: number | null;
  colorIdentity: string[];
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

/** User-configurable definition of a keepable opening hand. */
export interface KeepableConfig {
  /** Minimum mana sources (lands + counted producers). */
  minSources: number;
  /** Maximum lands — more than this is a flooded hand. */
  maxLands: number;
  /** Count mana dorks (creatures that produce mana) as sources. */
  countDorks: boolean;
  /** Count mana rocks (artifacts that produce mana) as sources. */
  countRocks: boolean;
  /** Floor of actual lands required when producers are being counted. */
  minLands: number;
  /** Only count producers with mana value at or below this. */
  maxProducerMV: number;
}

export interface HandAnalysis {
  landCount: number;
  /** Lands plus counted mana producers. */
  manaSources: number;
  typeCounts: Record<CardType, number>;
  keepable: boolean;
}

export interface BatchStats {
  handCount: number;
  avgLands: number;
  avgManaSources: number;
  keepablePct: number;
  config: KeepableConfig;
  avgTypeCounts: Record<CardType, number>;
  /** Index = number of lands in hand (0..7). */
  landDistribution: number[];
}
