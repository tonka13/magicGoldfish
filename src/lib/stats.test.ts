import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { analyzeHand, summarizeBatch } from './stats';
import { drawBatch, drawHand } from './simulator';
import type { Card } from './types';

const card = (name: string, typeLine: string): Card => ({
  name,
  typeLine,
  primaryType: classifyTypeLine(typeLine),
});

const forest = card('Forest', 'Basic Land — Forest');
const elf = card('Llanowar Elves', 'Creature — Elf Druid');
const solRing = card('Sol Ring', 'Artifact');
const bolt = card('Lightning Bolt', 'Instant');

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

describe('analyzeHand', () => {
  it('counts types and lands', () => {
    const analysis = analyzeHand([forest, forest, forest, elf, elf, solRing, bolt], 3, 5);
    expect(analysis.landCount).toBe(3);
    expect(analysis.typeCounts.Creature).toBe(2);
    expect(analysis.typeCounts.Artifact).toBe(1);
    expect(analysis.typeCounts.Instant).toBe(1);
    expect(analysis.keepable).toBe(true);
  });

  it('marks hands outside the land range as not keepable', () => {
    expect(analyzeHand([forest, elf, elf, elf, elf, elf, elf], 3, 5).keepable).toBe(false);
    expect(analyzeHand([forest, forest, forest, forest, forest, forest, elf], 3, 5).keepable).toBe(false);
  });
});

describe('summarizeBatch', () => {
  it('computes averages, keepable %, and distribution', () => {
    const hands = [
      [forest, forest, forest, elf, elf, solRing, bolt], // 3 lands, keepable
      [forest, elf, elf, elf, elf, elf, elf], // 1 land, not keepable
    ];
    const stats = summarizeBatch(hands, 3, 5);
    expect(stats.handCount).toBe(2);
    expect(stats.avgLands).toBe(2);
    expect(stats.keepablePct).toBe(50);
    expect(stats.landDistribution[3]).toBe(1);
    expect(stats.landDistribution[1]).toBe(1);
    expect(stats.avgTypeCounts.Creature).toBe(4);
  });

  it('handles an empty batch without NaN', () => {
    const stats = summarizeBatch([], 3, 5);
    expect(stats.avgLands).toBe(0);
    expect(stats.keepablePct).toBe(0);
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
    const stats = summarizeBatch(hands, 3, 5);
    const expected = 7 * (40 / 99); // ≈ 2.83
    expect(stats.avgLands).toBeGreaterThan(expected - 0.15);
    expect(stats.avgLands).toBeLessThan(expected + 0.15);
  });
});
