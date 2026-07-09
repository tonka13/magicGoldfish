/**
 * Live integration test against the real Scryfall API — exercises the exact
 * path the app uses on deck load. Skipped except in --mode live, so plain
 * `npm test` works offline. Run with: npm run test:live
 */
import { describe, expect, it } from 'vitest';
import { classifyTypeLine } from './classify';
import { parseDecklist } from './parser';
import { SAMPLE_DECK } from './sampleDeck';
import { normalizeName, resolveTypeLines } from './scryfall';

describe.skipIf(import.meta.env.MODE !== 'live')('scryfall live', () => {
  it('resolves the whole sample deck', { timeout: 30000 }, async () => {
    const parsed = parseDecklist(SAMPLE_DECK);
    const names = [...parsed.library, parsed.commander!];
    const { typeLines, notFound } = await resolveTypeLines(names);

    expect(notFound).toEqual([]);

    const typeOf = (name: string) =>
      classifyTypeLine(typeLines.get(normalizeName(name)) ?? null);

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
    expect(typeLines.get(normalizeName('Goreclaw, Terror of Qal Sisma'))).toMatch(
      /Legendary Creature/,
    );
  });
});
