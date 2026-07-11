import type { Card } from './types';

/**
 * Deck-adaptive accent theme: the app's accent color follows the deck's
 * dominant mana color, with a WUBRG-ordered gradient of every color in the
 * deck's identity for decorative touches. Light/dark pairs are pre-picked so
 * the light value carries white text and the dark value carries dark text.
 */
export interface DeckTheme {
  accentLight: string;
  accentDark: string;
  softLight: string;
  softDark: string;
  /** Colors present in the deck, WUBRG order (empty = colorless/no deck). */
  identity: string[];
  /** CSS linear-gradient of the identity colors, for decorative hairlines. */
  gradient: string;
}

const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const;

const ACCENTS: Record<string, [string, string, string, string]> = {
  //    [accentLight, accentDark, softLight, softDark]
  W: ['#8f741d', '#d6ba58', '#e6d9a8', '#5c4f1e'],
  U: ['#2a6fc4', '#5b9be6', '#a9c8ee', '#1c4576'],
  B: ['#6b4b9e', '#a488d9', '#cbbbe6', '#41305f'],
  R: ['#bb3a2c', '#e0695a', '#eab3ac', '#6e241b'],
  G: ['#2f7d44', '#5cb87a', '#aed6ba', '#1d4a2a'],
  // Colorless deck / no deck loaded: neutral "old gold" brand accent.
  C: ['#8a6d3b', '#c9a85c', '#dcc9a2', '#544021'],
};

/** Decorative gradient stops — mid-brightness so they read on both themes. */
const PIP_COLORS: Record<string, string> = {
  W: '#d9bd62',
  U: '#4a90e2',
  B: '#8f6fc9',
  R: '#d95f50',
  G: '#4caf6d',
};

export const DEFAULT_THEME = themeFor('C', []);

function themeFor(dominant: string, identity: string[]): DeckTheme {
  const [accentLight, accentDark, softLight, softDark] =
    ACCENTS[dominant] ?? ACCENTS.C;
  const stops = identity.length
    ? identity.map((c) => PIP_COLORS[c])
    : [ACCENTS.C[1]];
  // A one-color gradient needs the stop twice to be a valid image.
  const gradient = `linear-gradient(90deg, ${
    stops.length === 1 ? `${stops[0]}, ${stops[0]}` : stops.join(', ')
  })`;
  return { accentLight, accentDark, softLight, softDark, identity, gradient };
}

/** Theme for a loaded deck: dominant color identity wins the accent. */
export function deckTheme(cards: Card[]): DeckTheme {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of cards) {
    for (const c of card.colorIdentity) {
      if (c in counts) counts[c]++;
    }
  }
  const identity = WUBRG.filter((c) => counts[c] > 0);
  if (identity.length === 0) return DEFAULT_THEME;
  // Most-played color wins; ties break in WUBRG order.
  const dominant = identity.reduce((best, c) =>
    counts[c] > counts[best] ? c : best,
  );
  return themeFor(dominant, identity);
}

/** Colors for the little mana-identity pips shown next to the commander. */
export function pipColor(color: string): string {
  return PIP_COLORS[color] ?? ACCENTS.C[1];
}
