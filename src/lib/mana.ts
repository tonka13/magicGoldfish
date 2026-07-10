import type { Card, KeepableConfig } from './types';

/**
 * Mana dorks and rocks are detected from Scryfall's produced_mana: a creature
 * or artifact that can produce mana. The mana-value cap keeps late-game
 * producers (e.g. a 9-drop that taps for mana) from counting as early ramp.
 */
export function isManaDork(card: Card, maxProducerMV: number): boolean {
  return (
    card.primaryType === 'Creature' &&
    card.producedMana.length > 0 &&
    (card.manaValue ?? Infinity) <= maxProducerMV
  );
}

export function isManaRock(card: Card, maxProducerMV: number): boolean {
  return (
    card.primaryType === 'Artifact' &&
    card.producedMana.length > 0 &&
    (card.manaValue ?? Infinity) <= maxProducerMV
  );
}

export interface ManaSourceCounts {
  lands: number;
  dorks: number;
  rocks: number;
  /** Lands plus the producer kinds enabled in the config. */
  total: number;
}

export function countManaSources(cards: Card[], config: KeepableConfig): ManaSourceCounts {
  let lands = 0;
  let dorks = 0;
  let rocks = 0;
  for (const card of cards) {
    if (card.primaryType === 'Land') lands++;
    else if (isManaDork(card, config.maxProducerMV)) dorks++;
    else if (isManaRock(card, config.maxProducerMV)) rocks++;
  }
  return {
    lands,
    dorks,
    rocks,
    total: lands + (config.countDorks ? dorks : 0) + (config.countRocks ? rocks : 0),
  };
}

/** Does any producer kind count toward mana sources under this config? */
export function producersCounted(config: KeepableConfig): boolean {
  return config.countDorks || config.countRocks;
}

/** Human-readable summary of the keepable definition (UI hints + CSV). */
export function describeKeepable(config: KeepableConfig): string {
  const curve = config.requireCurve ? ', with a castable turn 1–3 curve' : '';
  if (!producersCounted(config)) {
    return `${config.minSources}–${config.maxLands} lands${curve}`;
  }
  const kinds = [config.countDorks && 'dorks', config.countRocks && 'rocks']
    .filter(Boolean)
    .join(' and ');
  return (
    `${config.minSources}+ mana sources (counting mana ${kinds} with mana value ` +
    `≤${config.maxProducerMV}), ${config.minLands}–${config.maxLands} lands${curve}`
  );
}
