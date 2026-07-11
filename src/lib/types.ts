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
  /** Scryfall mana_cost, e.g. "{2}{W}" — null when unknown, '' for lands. */
  manaCost: string | null;
  colorIdentity: string[];
  /** Scryfall card image URL — optional, UI-only (analysis never needs it). */
  imageUrl?: string | null;
}

/** A specific printing named in a decklist, e.g. "(C21) 263". */
export interface CardVersion {
  set: string;
  collectorNumber?: string;
}

export interface ParsedDeck {
  /** Commander card name if the paste marked one, else null. */
  commander: string | null;
  /** Library entries expanded by quantity (commander excluded). */
  library: string[];
  /** Lines that could not be parsed as cards and were skipped. */
  skippedLines: string[];
  warnings: string[];
  /** Specific printings by normalized name, when the paste named them. */
  versions: Record<string, CardVersion>;
}

export interface DrawnHand {
  cards: Card[];
  /** Mulligans taken before this hand was kept (0 for batch hands). */
  mulligans: number;
  /**
   * The user's actual keep decision in single-hand mode (true = kept,
   * false = gave up). Unset for batch hands — the keepable definition rules.
   */
  kept?: boolean;
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
  /**
   * Require a castable turn 1–3 curve: land turns 1 and 2, a spell castable
   * off those two lands' colors by turn 2, and a turn-3 play (3 mana, or 4
   * when the turn-2 play was a mana dork/rock).
   */
  requireCurve: boolean;
}

export interface HandAnalysis {
  landCount: number;
  /** Lands plus counted mana producers. */
  manaSources: number;
  typeCounts: Record<CardType, number>;
  /** Quantity checks passed (sources / land range). */
  manaOk: boolean;
  /** The hand can make the turn 1–3 curve with its actual colors. */
  curvesOut: boolean;
  keepable: boolean;
}

export interface BatchStats {
  handCount: number;
  avgLands: number;
  avgManaSources: number;
  keepablePct: number;
  /** % of hands passing the turn 1–3 curve check (computed regardless of toggle). */
  curveOutPct: number;
  config: KeepableConfig;
  avgTypeCounts: Record<CardType, number>;
  /** Index = number of lands in hand (0..7). */
  landDistribution: number[];
}
