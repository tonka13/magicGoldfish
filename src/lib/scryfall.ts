import type { CardVersion } from './types';

const CACHE_KEY = 'goldfish-cards-v4';
const OLD_CACHE_KEYS = ['goldfish-typelines-v1', 'goldfish-cards-v2', 'goldfish-cards-v3'];
const BATCH_SIZE = 75; // Scryfall /cards/collection limit
const BATCH_DELAY_MS = 120;

/** Everything the app needs to know about a card, from Scryfall. */
export interface CardData {
  /** Real Oracle name — differs from the requested name for flavor names. */
  oracleName: string;
  typeLine: string;
  producedMana: string[];
  manaValue: number | null;
  manaCost: string | null;
  colorIdentity: string[];
  /** Scryfall "normal" card image (front face for DFCs). */
  imageUrl: string | null;
}

/** Compact localStorage form of CardData. */
interface CacheEntry {
  t: string;
  n?: string;
  m?: string[];
  c?: number;
  mc?: string;
  i?: string[];
  u?: string;
}

export interface ResolveResult {
  /** normalized name -> card data */
  cards: Map<string, CardData>;
  notFound: string[];
}

export function normalizeName(name: string): string {
  // Front face only: pastes often have just "Delver of Secrets" for DFCs.
  return name.split('//')[0].trim().toLowerCase();
}

function fromEntry(entry: CacheEntry): CardData {
  return {
    oracleName: entry.n ?? '',
    typeLine: entry.t,
    producedMana: entry.m ?? [],
    manaValue: entry.c ?? null,
    manaCost: entry.mc ?? null,
    colorIdentity: entry.i ?? [],
    imageUrl: entry.u ?? null,
  };
}

function toEntry(data: CardData): CacheEntry {
  const entry: CacheEntry = { t: data.typeLine };
  if (data.oracleName) entry.n = data.oracleName;
  if (data.producedMana.length) entry.m = data.producedMana;
  if (data.manaValue !== null) entry.c = data.manaValue;
  if (data.manaCost !== null) entry.mc = data.manaCost;
  if (data.colorIdentity.length) entry.i = data.colorIdentity;
  if (data.imageUrl) entry.u = data.imageUrl;
  return entry;
}

function loadCache(): Record<string, CacheEntry> {
  try {
    if (typeof localStorage === 'undefined') return {};
    for (const key of OLD_CACHE_KEYS) localStorage.removeItem(key);
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache full or unavailable — resolving still works, just not persisted.
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ScryfallCard {
  name: string;
  flavor_name?: string;
  type_line?: string;
  produced_mana?: string[];
  cmc?: number;
  mana_cost?: string;
  color_identity?: string[];
  image_uris?: { normal?: string };
  card_faces?: {
    name: string;
    type_line?: string;
    mana_cost?: string;
    image_uris?: { normal?: string };
  }[];
}

const SCRYFALL_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  // Scryfall requires an identifying UA; browsers drop this header and
  // send their own, which also passes.
  'User-Agent': 'CommanderGoldfish/1.0',
};

function toCardData(card: ScryfallCard): CardData {
  return {
    oracleName: card.name,
    typeLine: card.type_line ?? card.card_faces?.[0]?.type_line ?? 'Unknown',
    producedMana: card.produced_mana ?? [],
    manaValue: card.cmc ?? null,
    // DFCs carry costs on their faces; what's in hand casts as the front.
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
    colorIdentity: card.color_identity ?? [],
    imageUrl:
      card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
  };
}

/**
 * Fallback for names the collection endpoint can't match — notably flavor
 * names on Universes Beyond prints (e.g. "Aang's Shelter" is a flavor name
 * of Teferi's Protection): /cards/named resolves those to the real card.
 */
async function resolveByNamed(name: string): Promise<ScryfallCard | null> {
  const res = await fetch(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
    { headers: SCRYFALL_HEADERS },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Scryfall request failed (${res.status})`);
  return (await res.json()) as ScryfallCard;
}

/** Scryfall collection identifier — by name, name+set, or exact printing. */
type Identifier =
  | { name: string }
  | { name: string; set: string }
  | { set: string; collector_number: string };

function identifierFor(name: string, version?: CardVersion): Identifier {
  if (version?.collectorNumber) {
    return { set: version.set, collector_number: version.collectorNumber };
  }
  if (version) return { name, set: version.set };
  return { name };
}

/** Stable key for matching a submitted identifier to a not_found echo. */
function identKey(id: Partial<Record<string, string>>): string {
  return id.collector_number
    ? `#${id.set}|${id.collector_number}`.toLowerCase()
    : `${id.name}|${id.set ?? ''}`.toLowerCase();
}

/** Cache key for a specific printing — kept apart from the default print. */
function versionKey(norm: string, version: CardVersion): string {
  return `${norm}|${version.set}|${version.collectorNumber ?? ''}`;
}

/**
 * Resolve card names to card data via Scryfall's collection endpoint,
 * consulting the localStorage cache first. When `versions` names a specific
 * printing (set / collector number from the pasted list), that exact print
 * is fetched so its image matches the list. Reports progress per batch.
 */
export async function resolveCards(
  names: string[],
  onProgress?: (done: number, total: number) => void,
  versions?: Record<string, CardVersion>,
): Promise<ResolveResult> {
  const cache = loadCache();
  const cards = new Map<string, CardData>();
  const missing: string[] = [];

  // Original casing for not-found reporting.
  const originalOf = new Map<string, string>();
  for (const name of names) {
    const norm = normalizeName(name);
    if (!originalOf.has(norm)) originalOf.set(norm, name.trim());
  }

  for (const norm of originalOf.keys()) {
    const version = versions?.[norm];
    const key = version ? versionKey(norm, version) : norm;
    if (cache[key]) cards.set(norm, fromEntry(cache[key]));
    else missing.push(norm);
  }

  const notFound: string[] = [];
  let fetched = 0;

  // Store under both the full and front-face oracle names plus the requested
  // name (differs for flavor names). Specific printings cache only under a
  // version-scoped key so they never become another deck's default image.
  const record = (card: ScryfallCard, requested?: string, version?: CardVersion) => {
    const cardData = toCardData(card);
    const entry = toEntry(cardData);
    const keys = new Set([
      normalizeName(card.name),
      normalizeName(card.name.split('//')[0]),
    ]);
    if (requested) keys.add(normalizeName(requested));
    if (version && requested) {
      cache[versionKey(normalizeName(requested), version)] = entry;
    } else {
      for (const key of keys) cache[key] = entry;
    }
    for (const key of keys) cards.set(key, cardData);
  };

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    if (i > 0) await sleep(BATCH_DELAY_MS);

    const requests = batch.map((norm) => ({
      norm,
      version: versions?.[norm],
      id: identifierFor(norm, versions?.[norm]),
    }));

    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: SCRYFALL_HEADERS,
      body: JSON.stringify({ identifiers: requests.map((r) => r.id) }),
    });
    if (!res.ok) throw new Error(`Scryfall request failed (${res.status})`);
    const data: {
      data: ScryfallCard[];
      not_found?: Partial<Record<string, string>>[];
    } = await res.json();

    // Found cards come back in request order with misses omitted; walk the
    // requests against the not_found echoes to pair each card to its ask.
    const missKeys = new Set((data.not_found ?? []).map(identKey));
    const queue = [...data.data];
    const misses: (typeof requests)[number][] = [];
    for (const req of requests) {
      if (missKeys.has(identKey(req.id)) || queue.length === 0) {
        misses.push(req);
        continue;
      }
      record(queue.shift()!, req.norm, req.version);
    }

    // Second chances: a bad set/collector number falls back to the card's
    // default print, and flavor names resolve through /cards/named.
    for (const miss of misses) {
      await sleep(BATCH_DELAY_MS);
      const card = await resolveByNamed(originalOf.get(miss.norm) ?? miss.norm);
      if (card) record(card, miss.norm);
      else notFound.push(originalOf.get(miss.norm) ?? miss.norm);
    }

    fetched += batch.length;
    onProgress?.(names.length - missing.length + fetched, names.length);
  }

  if (missing.length > 0) saveCache(cache);
  return { cards, notFound };
}
