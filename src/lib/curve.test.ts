import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { canPay, hasCastableCurve, manaValueOf, parseManaCost } from './curve';
import { DEFAULT_KEEPABLE } from './stats';
import type { Card } from './types';

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

const plains = card('Plains', 'Basic Land — Plains', { producedMana: ['W'] });
const mountain = card('Mountain', 'Basic Land — Mountain', { producedMana: ['R'] });
const forest = card('Forest', 'Basic Land — Forest', { producedMana: ['G'] });
const anyLand = card('Command Tower', 'Land', { producedMana: ['W', 'U', 'B', 'R', 'G'] });
const fetch = card('Evolving Wilds', 'Land', {}); // no produced_mana

const whiteTwoDrop = card('Knight', 'Creature — Knight', { manaValue: 2, manaCost: '{1}{W}' });
const redTwoDrop = card('Goblin', 'Creature — Goblin', { manaValue: 2, manaCost: '{1}{R}' });
const redThreeDrop = card('Ogre', 'Creature — Ogre', { manaValue: 3, manaCost: '{2}{R}' });
const dork = card('Llanowar Elves', 'Creature — Elf Druid', {
  producedMana: ['G'],
  manaValue: 1,
  manaCost: '{G}',
});
const greenTwoDrop = card('Bears', 'Creature — Bear', { manaValue: 2, manaCost: '{1}{G}' });
const wurm = card('Wurm', 'Creature — Wurm', { manaValue: 4, manaCost: '{2}{G}{G}' });
const filler = card('Filler', 'Sorcery', { manaValue: 6, manaCost: '{5}{G}' });

describe('parseManaCost', () => {
  it('parses generic + pips', () => {
    expect(parseManaCost('{2}{W}')).toEqual({ generic: 2, pips: [['W']] });
    expect(parseManaCost('{G}{G}')).toEqual({ generic: 0, pips: [['G'], ['G']] });
  });

  it('treats X as zero', () => {
    const cost = parseManaCost('{X}{G}{G}')!;
    expect(cost.generic).toBe(0);
    expect(manaValueOf(cost)).toBe(2);
  });

  it('parses hybrid pips as options and drops Phyrexian pips', () => {
    expect(parseManaCost('{W/U}')).toEqual({ generic: 0, pips: [['W', 'U']] });
    expect(parseManaCost('{G/P}')).toEqual({ generic: 0, pips: [] });
  });

  it('returns null for uncastable/no cost', () => {
    expect(parseManaCost(null)).toBeNull();
    expect(parseManaCost('')).toBeNull();
  });
});

describe('canPay', () => {
  const cost = (s: string) => parseManaCost(s)!;

  it('matches colored pips against source colors', () => {
    expect(canPay(cost('{W}{W}'), [plains, plains])).toBe(true);
    expect(canPay(cost('{W}{W}'), [plains, mountain])).toBe(false);
    expect(canPay(cost('{1}{W}'), [plains, mountain])).toBe(true);
  });

  it('needs enough total mana', () => {
    expect(canPay(cost('{3}{G}'), [forest, forest, forest])).toBe(false);
    expect(canPay(cost('{2}{G}'), [forest, forest, forest])).toBe(true);
  });

  it('any-color lands and fetches pay any pip', () => {
    expect(canPay(cost('{W}{R}'), [anyLand, mountain])).toBe(true);
    expect(canPay(cost('{W}'), [fetch])).toBe(true);
  });

  it('assigns constrained pips before flexible ones', () => {
    // The Plains must pay {W}, leaving the any-color land for {R}.
    expect(canPay(cost('{W}{R}'), [plains, anyLand])).toBe(true);
  });
});

describe('hasCastableCurve', () => {
  const config = DEFAULT_KEEPABLE;

  it("fails a WR hand whose white spells have no white source", () => {
    const hand = [mountain, mountain, mountain, whiteTwoDrop, whiteTwoDrop, filler, filler];
    expect(hasCastableCurve(hand, config)).toBe(false);
  });

  it('passes when the colors line up', () => {
    const hand = [mountain, mountain, plains, whiteTwoDrop, redThreeDrop, filler, filler];
    expect(hasCastableCurve(hand, config)).toBe(true);
  });

  it('requires a castable turn-2 play', () => {
    const hand = [mountain, mountain, mountain, redThreeDrop, filler, filler, filler];
    expect(hasCastableCurve(hand, config)).toBe(false);
  });

  it('requires a turn-3 play (two lands, no producer, nothing else castable)', () => {
    const hand = [mountain, mountain, redTwoDrop, filler, filler, filler, filler];
    expect(hasCastableCurve(hand, config)).toBe(false);
  });

  it('lets a turn-2 dork power a 4-mana turn-3 play', () => {
    const withDork = [forest, forest, forest, dork, wurm, filler, filler];
    expect(hasCastableCurve(withDork, config)).toBe(true);
    // Same shape but the turn-2 play makes no mana: the wurm stays uncastable.
    const withoutDork = [forest, forest, forest, greenTwoDrop, wurm, filler, filler];
    expect(hasCastableCurve(withoutDork, config)).toBe(false);
  });

  it('dork boost is off when dorks are not counted', () => {
    const hand = [forest, forest, forest, dork, wurm, filler, filler];
    expect(hasCastableCurve(hand, { ...config, countDorks: false })).toBe(false);
  });

  it('two cheap spells satisfy turns 2 and 3', () => {
    const hand = [mountain, mountain, mountain, redTwoDrop, redTwoDrop, filler, filler];
    expect(hasCastableCurve(hand, config)).toBe(true);
  });
});
