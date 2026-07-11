import { normalizeName } from './scryfall';
import type { CardVersion, ParsedDeck } from './types';

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

interface ParsedLine {
  quantity: number;
  name: string;
  isCommander: boolean;
  /** Specific printing when the line carried "(SET) 123". */
  version?: CardVersion;
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

  // Leading quantity: "1 ", "1x ", "3X ".
  let quantity = 1;
  const qty = text.match(/^(\d+)\s*[xX]?\s+(.+)$/);
  if (qty) {
    quantity = parseInt(qty[1], 10);
    text = qty[2];
  }

  // Peel trailing junk — "#tags", "*F*" foil markers, "[Ramp]" categories —
  // repeatedly, since exports stack them after the set/collector number.
  let prev;
  do {
    prev = text;
    text = text
      .replace(/\s+#\S.*$/, '')
      .replace(/\s+\*[^*]*\*\s*$/, '')
      .replace(/\s+\[[^\]]*\]\s*$/, '')
      .trim();
  } while (text !== prev);

  // "(SET) 123" — capture the specific printing rather than discarding it,
  // so the app can show the exact card version the list named.
  let version: CardVersion | undefined;
  const ver = text.match(/^(.+?)\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([\w★†-]+))?$/);
  if (ver) {
    text = ver[1].trim();
    version = { set: ver[2].toLowerCase(), collectorNumber: ver[3] };
  }

  const name = text.replace(/\s{2,}/g, ' ').trim();
  if (!name || quantity < 1) return null;
  // A "name" that is purely digits/punctuation is junk, not a card.
  if (!/[A-Za-z]/.test(name)) return null;

  return { quantity, name, isCommander, version };
}

export function parseDecklist(text: string): ParsedDeck {
  const library: string[] = [];
  const skippedLines: string[] = [];
  const warnings: string[] = [];
  const versions: Record<string, CardVersion> = {};
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

    if (parsed.version) {
      const key = normalizeName(parsed.name);
      if (!versions[key]) versions[key] = parsed.version;
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

  return { commander, library, skippedLines, warnings, versions };
}
