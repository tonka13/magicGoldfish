import { isManaDork, isManaRock } from './mana';
import type { Card, KeepableConfig } from './types';

const ALL_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];

/** A parsed cost: generic amount plus one option-set per colored pip. */
export interface ParsedCost {
  generic: number;
  /** Each pip lists the colors that can pay it (hybrid = several). */
  pips: string[][];
}

/**
 * Parse a Scryfall mana_cost like "{1}{W}{W}" or "{X}{G}" or "{W/U}{W/U}".
 * X counts as 0 (cast it small). Phyrexian pips are payable with life and
 * are dropped. Returns null for costs we can't cast conventionally (no cost
 * at all — lands, suspend-only cards).
 */
export function parseManaCost(manaCost: string | null): ParsedCost | null {
  if (manaCost === null || manaCost === '') return null;
  const cost: ParsedCost = { generic: 0, pips: [] };
  for (const [, symbol] of manaCost.matchAll(/\{([^}]+)\}/g)) {
    const parts = symbol.toUpperCase().split('/');
    if (parts.includes('P')) continue; // Phyrexian — pay 2 life instead
    if (parts.length === 1) {
      const s = parts[0];
      if (/^\d+$/.test(s)) cost.generic += parseInt(s, 10);
      else if (s === 'X' || s === 'Y' || s === 'Z') continue; // X = 0
      else if (s === 'S') cost.generic += 1; // snow — any mana, roughly
      else if (ALL_COLORS.includes(s)) cost.pips.push([s]);
      else cost.generic += 1; // unknown symbol — treat as generic
    } else {
      // Hybrid: {W/U} pays with either color; {2/W} can always fall back to
      // generic, so treat it as payable by anything.
      const colors = parts.filter((p) => ALL_COLORS.includes(p));
      const hasGeneric = parts.some((p) => /^\d+$/.test(p));
      cost.pips.push(hasGeneric ? [...ALL_COLORS] : colors.length ? colors : [...ALL_COLORS]);
    }
  }
  return cost;
}

export function manaValueOf(cost: ParsedCost): number {
  return cost.generic + cost.pips.length;
}

/**
 * Colors a source can make when tapped for one mana. Lands with no
 * produced_mana (fetches like Evolving Wilds) are treated as any color —
 * in practice they found the color you needed a turn earlier.
 */
function sourceColors(card: Card): string[] {
  return card.producedMana.length ? card.producedMana : [...ALL_COLORS];
}

/**
 * Can `sources` (each tapping for one mana of its listed colors) pay `cost`?
 * Backtracking assignment of pips to distinct sources; leftovers pay generic.
 */
export function canPay(cost: ParsedCost, sources: Card[]): boolean {
  if (manaValueOf(cost) > sources.length) return false;
  const options = sources.map(sourceColors);
  // Most-constrained pip first keeps the backtracking tiny.
  const pips = [...cost.pips].sort((a, b) => a.length - b.length);
  const used = new Array(options.length).fill(false);

  const assign = (pipIndex: number): boolean => {
    if (pipIndex === pips.length) return true;
    for (let s = 0; s < options.length; s++) {
      if (used[s]) continue;
      if (!pips[pipIndex].some((c) => options[s].includes(c))) continue;
      used[s] = true;
      if (assign(pipIndex + 1)) return true;
      used[s] = false;
    }
    return false;
  };

  return assign(0);
}

function* combinations<T>(items: T[], k: number): Generator<T[]> {
  if (k > items.length) return;
  const indices = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield indices.map((i) => items[i]);
    let i = k - 1;
    while (i >= 0 && indices[i] === items.length - k + i) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  }
}

/**
 * The turn 1–3 curve check:
 *  - turn 1 and turn 2 land drops (≥2 lands in hand),
 *  - by turn 2, some spell castable off those two lands' actual colors,
 *  - a different spell castable on turn 3 with the mana then available:
 *    3 lands, or 2–3 lands plus the turn-2 dork/rock tapping for its color
 *    (3 lands + producer = the 4-mana turn-3 play).
 */
export function hasCastableCurve(cards: Card[], config: KeepableConfig): boolean {
  const lands = cards.filter((c) => c.primaryType === 'Land');
  if (lands.length < 2) return false;

  const spells = cards
    .map((card, index) => ({ card, index, cost: parseManaCost(card.manaCost) }))
    .filter(
      (s): s is { card: Card; index: number; cost: ParsedCost } =>
        s.card.primaryType !== 'Land' && s.cost !== null,
    );

  const landsByTurn3 = Math.min(3, lands.length);
  for (const landTrio of combinations(lands, landsByTurn3)) {
    for (const landPair of combinations(landTrio, 2)) {
      for (const t2 of spells) {
        if (manaValueOf(t2.cost) > 2 || !canPay(t2.cost, landPair)) continue;
        const isProducer =
          (config.countDorks && isManaDork(t2.card, config.maxProducerMV)) ||
          (config.countRocks && isManaRock(t2.card, config.maxProducerMV));
        const turn3Sources = isProducer ? [...landTrio, t2.card] : landTrio;
        for (const t3 of spells) {
          if (t3.index === t2.index) continue;
          if (canPay(t3.cost, turn3Sources)) return true;
        }
      }
    }
  }
  return false;
}
