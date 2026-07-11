import { describe, expect, it } from 'vitest';
import { parseDecklist } from './parser';
import { SAMPLE_DECK } from './sampleDeck';

describe('parseDecklist', () => {
  it('parses simple quantity lines', () => {
    const deck = parseDecklist('1 Sol Ring\n1 Command Tower');
    expect(deck.library).toEqual(['Sol Ring', 'Command Tower']);
  });

  it('expands quantities', () => {
    const deck = parseDecklist('3 Forest');
    expect(deck.library).toEqual(['Forest', 'Forest', 'Forest']);
  });

  it('accepts 1x style and bare names', () => {
    const deck = parseDecklist('1x Sol Ring\nCommand Tower');
    expect(deck.library).toEqual(['Sol Ring', 'Command Tower']);
  });

  it('strips set codes, collector numbers, and foil markers', () => {
    const deck = parseDecklist(
      '1 Sol Ring (C21) 263\n1 Arcane Signet (CMR) 297 *F*\n1 Forest [ZNR]',
    );
    expect(deck.library).toEqual(['Sol Ring', 'Arcane Signet', 'Forest']);
  });

  it('captures specific printings so their exact images can be fetched', () => {
    const deck = parseDecklist(
      '1 Sol Ring (C21) 263\n1 Arcane Signet (CMR) 297 *F*\n1 Lightning Greaves (SLD)\n1 Forest',
    );
    expect(deck.versions['sol ring']).toEqual({ set: 'c21', collectorNumber: '263' });
    expect(deck.versions['arcane signet']).toEqual({ set: 'cmr', collectorNumber: '297' });
    expect(deck.versions['lightning greaves']).toEqual({ set: 'sld' });
    expect(deck.versions['forest']).toBeUndefined();
  });

  it('captures the commander printing too', () => {
    const deck = parseDecklist('Commander: Goreclaw, Terror of Qal Sisma (M19) 186\n1 Forest');
    expect(deck.commander).toBe('Goreclaw, Terror of Qal Sisma');
    expect(deck.versions['goreclaw, terror of qal sisma']).toEqual({
      set: 'm19',
      collectorNumber: '186',
    });
  });

  it('keeps names containing commas and apostrophes intact', () => {
    const deck = parseDecklist("1 Atraxa, Praetors' Voice\n1 Green Sun's Zenith");
    expect(deck.library).toEqual(["Atraxa, Praetors' Voice", "Green Sun's Zenith"]);
  });

  it('ignores blank lines, comments, and section headers', () => {
    const deck = parseDecklist(
      '\nDeck\n// my ramp package\n# tags\nCreatures (2)\n1 Llanowar Elves\n\nLands - 1\n1 Forest\n',
    );
    expect(deck.library).toEqual(['Llanowar Elves', 'Forest']);
    expect(deck.skippedLines).toEqual([]);
  });

  it('detects Commander: prefix and excludes it from the library', () => {
    const deck = parseDecklist('Commander: Goreclaw, Terror of Qal Sisma\n1 Forest');
    expect(deck.commander).toBe('Goreclaw, Terror of Qal Sisma');
    expect(deck.library).toEqual(['Forest']);
  });

  it('detects *CMDR* tag', () => {
    const deck = parseDecklist('1 Goreclaw, Terror of Qal Sisma *CMDR*\n1 Forest');
    expect(deck.commander).toBe('Goreclaw, Terror of Qal Sisma');
    expect(deck.library).toEqual(['Forest']);
  });

  it('detects a Commander section header (ends at blank line)', () => {
    const deck = parseDecklist('Commander\n1 Goreclaw, Terror of Qal Sisma\n\n1 Forest');
    expect(deck.commander).toBe('Goreclaw, Terror of Qal Sisma');
    expect(deck.library).toEqual(['Forest']);
  });

  it('handles messy whitespace', () => {
    const deck = parseDecklist('   1    Sol Ring   \n\t2\tForest\t');
    expect(deck.library).toEqual(['Sol Ring', 'Forest', 'Forest']);
  });

  it('warns when the library is not 99 with a commander', () => {
    const deck = parseDecklist('Commander: Goreclaw, Terror of Qal Sisma\n1 Forest');
    expect(deck.warnings.some((w) => w.includes('expected 99'))).toBe(true);
  });

  it('parses the embedded sample deck to exactly 99 + commander', () => {
    const deck = parseDecklist(SAMPLE_DECK);
    expect(deck.commander).toBe('Goreclaw, Terror of Qal Sisma');
    expect(deck.library).toHaveLength(99);
    expect(deck.warnings).toEqual([]);
    expect(deck.skippedLines).toEqual([]);
  });
});
