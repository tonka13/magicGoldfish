import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { describeKeepable, isManaDork, isManaRock } from './mana';
import { DEFAULT_KEEPABLE, analyzeHand, summarizeBatch } from './stats';
import { drawBatch, drawHand } from './simulator';
import type { Card, KeepableConfig } from './types';

const card = (
  name: string,
  typeLine: string,
  extra: Partial<Pick<Card, 'producedMana' | 'manaValue' | 'manaCost'>> = {},
): Card => ({
  name,
  oracleName: name,
  typeLine,
  primaryType: classifyTypeLine(typeLine),
  producedMana: extra.producedMana ?? [],
  manaValue: extra.manaValue ?? null,
  manaCost: extra.manaCost ?? null,
  colorIdentity: [],
});

const forest = card('Forest', 'Basic Land — Forest', { producedMana: ['G'], manaValue: 0 });
const elf = card('Grizzly Bears', 'Creature — Bear', { manaValue: 2, manaCost: '{1}{G}' });
const dork = card('Llanowar Elves', 'Creature — Elf Druid', {
  producedMana: ['G'],
  manaValue: 1,
  manaCost: '{G}',
});
const rock = card('Sol Ring', 'Artifact', {
  producedMana: ['C'],
  manaValue: 1,
  manaCost: '{1}',
});
const bigDork = card("Karametra's Acolyte", 'Creature — Human Druid', {
  producedMana: ['G'],
  manaValue: 4,
  manaCost: '{3}{G}',
});
const bolt = card('Lightning Bolt', 'Instant', { manaValue: 1, manaCost: '{R}' });

const landsOnly: KeepableConfig = {
  ...DEFAULT_KEEPABLE,
  countDorks: false,
  countRocks: false,
};

describe('classifyTypeLine', () => {
  it('classifies basic types', () => {
    expect(classifyTypeLine('Basic Land — Forest')).toBe('Land');
    expect(classifyTypeLine('Instant')).toBe('Instant');
    expect(classifyTypeLine('Legendary Planeswalker — Garruk')).toBe('Planeswalker');
  });

  it('prefers Land over Creature (creature lands)', () => {
    expect(classifyTypeLine('Land Creature — Forest Dryad')).toBe('Land');
  });

  it('prefers Creature over Artifact (artifact creatures)', () => {
    expect(classifyTypeLine('Legendary Artifact Creature — Golem')).toBe('Creature');
  });

  it('uses only the front face of DFCs', () => {
    expect(classifyTypeLine('Creature — Human Wizard // Creature — Human Insect')).toBe('Creature');
  });

  it('returns Unknown for missing type lines', () => {
    expect(classifyTypeLine(null)).toBe('Unknown');
  });
});

describe('mana producers', () => {
  it('detects dorks and rocks by produced mana and type', () => {
    expect(isManaDork(dork, 3)).toBe(true);
    expect(isManaDork(elf, 3)).toBe(false);
    expect(isManaRock(rock, 3)).toBe(true);
    expect(isManaRock(dork, 3)).toBe(false);
    // Lands produce mana but are neither dorks nor rocks.
    expect(isManaDork(forest, 3)).toBe(false);
    expect(isManaRock(forest, 3)).toBe(false);
  });

  it('respects the producer mana-value cap', () => {
    expect(isManaDork(bigDork, 3)).toBe(false);
    expect(isManaDork(bigDork, 4)).toBe(true);
  });
});

describe('analyzeHand (default config: 3+ sources, ≤4 lands, ≥2 lands)', () => {
  it('counts types, lands, and mana sources', () => {
    const analysis = analyzeHand([forest, forest, forest, elf, elf, rock, bolt], DEFAULT_KEEPABLE);
    expect(analysis.landCount).toBe(3);
    expect(analysis.manaSources).toBe(4); // 3 lands + Sol Ring
    expect(analysis.typeCounts.Creature).toBe(2);
    expect(analysis.typeCounts.Artifact).toBe(1);
    expect(analysis.keepable).toBe(true);
  });

  it('keeps 2 lands + a dork or rock', () => {
    expect(analyzeHand([forest, forest, dork, elf, elf, bolt, bolt], DEFAULT_KEEPABLE).keepable).toBe(true);
    expect(analyzeHand([forest, forest, rock, elf, elf, bolt, bolt], DEFAULT_KEEPABLE).keepable).toBe(true);
  });

  it('does not keep 2 lands with no producers', () => {
    expect(analyzeHand([forest, forest, elf, elf, elf, bolt, bolt], DEFAULT_KEEPABLE).keepable).toBe(false);
  });

  it('does not keep 1 land + 2 dorks (land floor)', () => {
    expect(analyzeHand([forest, dork, dork, elf, elf, bolt, bolt], DEFAULT_KEEPABLE).keepable).toBe(false);
  });

  it('does not keep 5 lands (flooded), even with producers', () => {
    expect(analyzeHand([forest, forest, forest, forest, forest, rock, elf], DEFAULT_KEEPABLE).keepable).toBe(false);
  });

  it('ignores producers above the mana-value cap', () => {
    expect(analyzeHand([forest, forest, bigDork, elf, elf, bolt, bolt], DEFAULT_KEEPABLE).keepable).toBe(false);
  });

  it('honors per-kind toggles', () => {
    const rocksOnly = { ...DEFAULT_KEEPABLE, countDorks: false };
    expect(analyzeHand([forest, forest, dork, elf, elf, bolt, bolt], rocksOnly).keepable).toBe(false);
    expect(analyzeHand([forest, forest, rock, elf, elf, bolt, bolt], rocksOnly).keepable).toBe(true);
  });

  it('falls back to a pure land range when producers are off', () => {
    expect(analyzeHand([forest, forest, forest, elf, elf, elf, elf], landsOnly).keepable).toBe(true);
    expect(analyzeHand([forest, forest, dork, rock, elf, bolt, bolt], landsOnly).keepable).toBe(false);
    expect(analyzeHand([forest, forest, forest, forest, forest, elf, elf], landsOnly).keepable).toBe(false);
  });
});

describe('summarizeBatch', () => {
  it('computes averages, keepable %, and distribution', () => {
    const hands = [
      [forest, forest, forest, elf, elf, rock, bolt], // 3 lands + rock, keepable
      [forest, elf, elf, elf, elf, elf, elf], // 1 land, not keepable
    ];
    const stats = summarizeBatch(hands, DEFAULT_KEEPABLE);
    expect(stats.handCount).toBe(2);
    expect(stats.avgLands).toBe(2);
    expect(stats.avgManaSources).toBe(2.5);
    expect(stats.keepablePct).toBe(50);
    expect(stats.landDistribution[3]).toBe(1);
    expect(stats.landDistribution[1]).toBe(1);
    expect(stats.avgTypeCounts.Creature).toBe(4);
  });

  it('handles an empty batch without NaN', () => {
    const stats = summarizeBatch([], DEFAULT_KEEPABLE);
    expect(stats.avgLands).toBe(0);
    expect(stats.keepablePct).toBe(0);
  });
});

describe('describeKeepable', () => {
  it('describes the pure land range', () => {
    expect(describeKeepable({ ...landsOnly, requireCurve: false })).toBe('3–4 lands');
    expect(describeKeepable(landsOnly)).toBe('3–4 lands, with a castable turn 1–3 curve');
  });

  it('describes producer counting', () => {
    expect(describeKeepable(DEFAULT_KEEPABLE)).toContain('dorks and rocks');
    expect(describeKeepable(DEFAULT_KEEPABLE)).toContain('≤3');
    expect(describeKeepable(DEFAULT_KEEPABLE)).toContain('2–4 lands');
  });
});

describe('simulator', () => {
  const library: Card[] = [
    ...Array.from({ length: 40 }, () => forest),
    ...Array.from({ length: 59 }, () => elf),
  ];

  it('draws 7 distinct positions from the library', () => {
    const hand = drawHand(library);
    expect(hand).toHaveLength(7);
  });

  it('draws no more cards than the library holds', () => {
    expect(drawHand([forest, elf])).toHaveLength(2);
  });

  it('batch averages converge on the hypergeometric expectation', () => {
    const hands = drawBatch(library, 2000);
    const stats = summarizeBatch(hands, DEFAULT_KEEPABLE);
    const expected = 7 * (40 / 99); // ≈ 2.83
    expect(stats.avgLands).toBeGreaterThan(expected - 0.15);
    expect(stats.avgLands).toBeLessThan(expected + 0.15);
  });
});
