/**
 * Live integration test against the real Scryfall API — exercises the exact
 * path the app uses on deck load. Skipped except in --mode live, so plain
 * `npm test` works offline. Run with: npm run test:live
 */
import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { parseDecklist } from './parser';
import { SAMPLE_DECK } from './sampleDeck';
import { normalizeName, resolveCards, type CardData } from './scryfall';
import { drawBatch } from './simulator';
import { DEFAULT_KEEPABLE, summarizeBatch } from './stats';
import type { Card } from './types';

describe.skipIf(import.meta.env.MODE !== 'live')('scryfall live', () => {
  it('resolves the whole sample deck', { timeout: 30000 }, async () => {
    const parsed = parseDecklist(SAMPLE_DECK);
    const names = [...parsed.library, parsed.commander!];
    const { cards, notFound } = await resolveCards(names);

    expect(notFound).toEqual([]);

    const dataOf = (name: string) => cards.get(normalizeName(name));
    const typeOf = (name: string) => classifyTypeLine(dataOf(name)?.typeLine ?? null);

    expect(typeOf('Forest')).toBe('Land');
    expect(typeOf('Sol Ring')).toBe('Artifact');
    expect(typeOf('Llanowar Elves')).toBe('Creature');
    expect(typeOf('Cultivate')).toBe('Sorcery');
    expect(typeOf('Beast Within')).toBe('Instant');
    expect(typeOf('Garruk, Primal Hunter')).toBe('Planeswalker');
    expect(typeOf('Rhythm of the Wild')).toBe('Enchantment');
    expect(typeOf('Goreclaw, Terror of Qal Sisma')).toBe('Creature');

    // Every card in the 99 resolves to a known type.
    const unknown = parsed.library.filter((n) => typeOf(n) === 'Unknown');
    expect(unknown).toEqual([]);

    // Commander type line marks a legal commander.
    expect(dataOf('Goreclaw, Terror of Qal Sisma')?.typeLine).toMatch(/Legendary Creature/);

    // Card images come through for the hand display.
    expect(dataOf('Sol Ring')?.imageUrl).toContain('scryfall');

    // Mana costs come through for the curve check.
    expect(dataOf('Cultivate')?.manaCost).toBe('{2}{G}');
    expect(dataOf('Sol Ring')?.manaCost).toBe('{1}');
    expect(dataOf('Forest')?.manaCost).toBe('');

    // Mana-producer data comes through for dork/rock detection.
    expect(dataOf('Llanowar Elves')?.producedMana).toContain('G');
    expect(dataOf('Llanowar Elves')?.manaValue).toBe(1);
    expect(dataOf('Sol Ring')?.producedMana).toContain('C');
    expect(dataOf('Cultivate')?.producedMana).toEqual([]);
    expect(dataOf('Forest')?.producedMana).toContain('G');
    expect(dataOf('Goreclaw, Terror of Qal Sisma')?.colorIdentity).toEqual(['G']);
  });

  it('produces sane batch stats end-to-end on the sample deck', { timeout: 30000 }, async () => {
    const parsed = parseDecklist(SAMPLE_DECK);
    const { cards, notFound } = await resolveCards(parsed.library);
    expect(notFound).toEqual([]);

    const toCard = (name: string): Card => {
      const d: CardData | undefined = cards.get(normalizeName(name));
      return {
        name,
        oracleName: d?.oracleName || name,
        typeLine: d?.typeLine ?? null,
        primaryType: classifyTypeLine(d?.typeLine ?? null),
        producedMana: d?.producedMana ?? [],
        manaValue: d?.manaValue ?? null,
        manaCost: d?.manaCost ?? null,
        colorIdentity: d?.colorIdentity ?? [],
      };
    };
    const library = parsed.library.map(toCard);
    const stats = summarizeBatch(drawBatch(library, 1000), DEFAULT_KEEPABLE);

    // eslint-disable-next-line no-console
    console.log(
      `sample deck, 1000 hands: avg lands ${stats.avgLands.toFixed(2)}, ` +
        `avg sources ${stats.avgManaSources.toFixed(2)}, ` +
        `curves out ${stats.curveOutPct.toFixed(1)}%, keepable ${stats.keepablePct.toFixed(1)}%`,
    );

    // Loose sanity bounds — a ramp-heavy mono-green deck should curve out
    // often, and the checks should neither reject nor accept everything.
    expect(stats.avgLands).toBeGreaterThan(2.2);
    expect(stats.avgLands).toBeLessThan(3.1);
    expect(stats.curveOutPct).toBeGreaterThan(40);
    expect(stats.keepablePct).toBeGreaterThan(20);
    expect(stats.keepablePct).toBeLessThan(95);
  });

  it('fetches the exact printing when the list names one', { timeout: 15000 }, async () => {
    const byDefault = await resolveCards(['Sol Ring']);
    const byPrint = await resolveCards(['Sol Ring'], undefined, {
      'sol ring': { set: 'c21', collectorNumber: '263' },
    });
    const def = byDefault.cards.get('sol ring');
    const print = byPrint.cards.get('sol ring');
    expect(byPrint.notFound).toEqual([]);
    expect(print?.oracleName).toBe('Sol Ring');
    expect(print?.manaCost).toBe('{1}');
    expect(print?.imageUrl).toContain('scryfall');
    // The C21 print's scan, not the default one.
    expect(print?.imageUrl).not.toBe(def?.imageUrl);
  });

  it('falls back to the default print for a bad set/collector number', { timeout: 15000 }, async () => {
    const { cards, notFound } = await resolveCards(['Sol Ring'], undefined, {
      'sol ring': { set: 'zzz', collectorNumber: '999' },
    });
    expect(notFound).toEqual([]);
    expect(cards.get('sol ring')?.oracleName).toBe('Sol Ring');
  });

  it('resolves Universes Beyond flavor names to the real card', { timeout: 15000 }, async () => {
    const { cards, notFound } = await resolveCards(["Aang's Shelter"]);
    expect(notFound).toEqual([]);
    const data = cards.get(normalizeName("Aang's Shelter"));
    expect(data?.oracleName).toBe("Teferi's Protection");
    expect(classifyTypeLine(data?.typeLine ?? null)).toBe('Instant');
    // The real name resolves to the same data.
    expect(cards.get(normalizeName("Teferi's Protection"))?.oracleName).toBe(
      "Teferi's Protection",
    );
  });
});
