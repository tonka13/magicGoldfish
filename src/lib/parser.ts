import type { ParsedDeck } from './types';

/**
 * Section headers commonly pasted from deck sites (Moxfield, Archidekt,
 * TappedOut, MTGGoldfish...). Matched against the whole line, optionally
 * followed by a count like "Creatures (24)" or "Lands - 37".
 */
const SECTION_HEADER = new RegExp(
  '^(deck|decklist|main|mainboard|maybeboard|sideboard|companion|commander|' +
    'lands?|creatures?|instants?|sorceries|artifacts?|enchantments?|' +
    'planeswalkers?|battles?|spells?|ramp|removal|draw|other|tokens?)' +
    '\\s*[:\\-–]?\\s*(\\(?\\d+\\)?)?$',
  'i',
);

/**
 * One decklist line: optional quantity ("1", "1x"), card name, then optional
 * trailing set/collector junk: "(C21) 263", "[C21]", "*F*", "#tag", "<foil>".
 */
const CARD_LINE = /^(?:(\d+)\s*[xX]?\s+)?(.+?)(?:\s+(?:\((?:[A-Za-z0-9]{2,6})\)|\[[^\]]*\])\s*[\w-★]*)?(?:\s+\*[^*]+\*)?(?:\s+#.*)?$/;

/** Strip trailing "(SET) 123 *F*"-style noise from a name candidate. */
function cleanName(raw: string): string {
  return raw
    .replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[\w-★]+)?\s*$/, '')
    .replace(/\s+\[[^\]]*\]\s*$/, '')
    .replace(/\s+\*[^*]*\*\s*$/, '')
    .replace(/\s+#\S.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface ParsedLine {
  quantity: number;
  name: string;
  isCommander: boolean;
}

function parseLine(line: string, inCommanderSection: boolean): ParsedLine | null {
  let text = line.trim();
  if (!text) return null;

  let isCommander = inCommanderSection;

  // "Commander: Atraxa, Praetors' Voice" or "CMDR: ..."
  const cmdrPrefix = text.match(/^(?:commander|cmdr)\s*:\s*(.+)$/i);
  if (cmdrPrefix) {
    text = cmdrPrefix[1].trim();
    isCommander = true;
  }

  // Trailing commander tags: "*CMDR*", "[Commander]", "(Commander)"
  const cmdrTag = /\s*(\*CMDR\*|\[commander\]|\(commander\))\s*$/i;
  if (cmdrTag.test(text)) {
    text = text.replace(cmdrTag, '').trim();
    isCommander = true;
  }

  const match = text.match(CARD_LINE);
  if (!match) return null;

  const quantity = match[1] ? parseInt(match[1], 10) : 1;
  const name = cleanName(match[2]);
  if (!name || quantity < 1) return null;
  // A "name" that is purely digits/punctuation is junk, not a card.
  if (!/[A-Za-z]/.test(name)) return null;

  return { quantity, name, isCommander };
}

export function parseDecklist(text: string): ParsedDeck {
  const library: string[] = [];
  const skippedLines: string[] = [];
  const warnings: string[] = [];
  let commander: string | null = null;
  let inCommanderSection = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      inCommanderSection = false;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('#')) continue;

    if (SECTION_HEADER.test(line)) {
      inCommanderSection = /^commander/i.test(line);
      continue;
    }

    const parsed = parseLine(line, inCommanderSection);
    if (!parsed) {
      skippedLines.push(line);
      continue;
    }

    if (parsed.isCommander && !commander) {
      commander = parsed.name;
      if (parsed.quantity > 1) {
        warnings.push(`Commander quantity ${parsed.quantity} ignored; using 1.`);
      }
      continue;
    }

    for (let i = 0; i < parsed.quantity; i++) library.push(parsed.name);
  }

  if (library.length === 0) {
    warnings.push('No cards found in the pasted list.');
  } else if (commander && library.length !== 99) {
    warnings.push(`Library is ${library.length} cards (expected 99).`);
  } else if (!commander && library.length !== 100 && library.length !== 99) {
    warnings.push(`Deck is ${library.length} cards (expected 100 with commander).`);
  }

  return { commander, library, skippedLines, warnings };
}
