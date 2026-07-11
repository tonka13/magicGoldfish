import type { Card } from './types';

/**
 * Commander color-identity check: every card in the 99 must fit inside the
 * commander's color identity. Returns the offenders (deduped by oracle name)
 * so the UI can call them out — deck testing still works regardless.
 *
 * Unresolved cards (no Scryfall data) are skipped: their identity is
 * unknown, and they already get their own "not found" warning.
 */
export function offColorCards(library: Card[], commander: Card): Card[] {
  const allowed = new Set(commander.colorIdentity);
  const seen = new Set<string>();
  const offenders: Card[] = [];
  for (const card of library) {
    if (card.typeLine === null) continue;
    if (seen.has(card.oracleName)) continue;
    seen.add(card.oracleName);
    if (card.colorIdentity.some((c) => !allowed.has(c))) offenders.push(card);
  }
  return offenders;
}
