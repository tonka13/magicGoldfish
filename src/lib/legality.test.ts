import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { offColorCards } from './legality';
import type { Card } from './types';

const card = (name: string, typeLine: string | null, colorIdentity: string[]): Card => ({
  name,
  oracleName: name,
  typeLine,
  primaryType: classifyTypeLine(typeLine),
  producedMana: [],
  manaValue: null,
  manaCost: null,
  colorIdentity,
});

const goreclaw = card('Goreclaw, Terror of Qal Sisma', 'Legendary Creature — Bear', ['G']);
const forest = card('Forest', 'Basic Land — Forest', ['G']);
const solRing = card('Sol Ring', 'Artifact', []);
const rhythm = card('Rhythm of the Wild', 'Enchantment', ['G', 'R']);
const bolt = card('Lightning Bolt', 'Instant', ['R']);

describe('offColorCards', () => {
  it('flags cards outside the commander color identity', () => {
    const offenders = offColorCards([forest, solRing, rhythm, bolt], goreclaw);
    expect(offenders.map((c) => c.name)).toEqual(['Rhythm of the Wild', 'Lightning Bolt']);
  });

  it('accepts an all-legal deck', () => {
    expect(offColorCards([forest, solRing], goreclaw)).toEqual([]);
  });

  it('flags every colored card under a colorless commander', () => {
    const kozilek = card('Kozilek, the Great Distortion', 'Legendary Creature — Eldrazi', []);
    const offenders = offColorCards([forest, solRing, bolt], kozilek);
    expect(offenders.map((c) => c.name)).toEqual(['Forest', 'Lightning Bolt']);
  });

  it('dedupes repeated offenders', () => {
    expect(offColorCards([bolt, bolt, bolt], goreclaw)).toHaveLength(1);
  });

  it('skips unresolved cards — identity unknown, not provably illegal', () => {
    const mystery = card('Sool Ring', null, []);
    expect(offColorCards([mystery], goreclaw)).toEqual([]);
  });
});
