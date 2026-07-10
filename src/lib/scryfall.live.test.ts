/**
 * Live integration test against the real Scryfall API — exercises the exact
 * path the app uses on deck load. Skipped except in --mode live, so plain
 * `npm test` works offline. Run with: npm run test:live
 */
import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { parseDecklist } from './parser';
import { SAMPLE_DECK } from './sampleDeck';
import { normalizeName, resolveCards } from './scryfall';

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

    // Mana-producer data comes through for dork/rock detection.
    expect(dataOf('Llanowar Elves')?.producedMana).toContain('G');
    expect(dataOf('Llanowar Elves')?.manaValue).toBe(1);
    expect(dataOf('Sol Ring')?.producedMana).toContain('C');
    expect(dataOf('Cultivate')?.producedMana).toEqual([]);
    expect(dataOf('Forest')?.producedMana).toContain('G');
    expect(dataOf('Goreclaw, Terror of Qal Sisma')?.colorIdentity).toEqual(['G']);
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
