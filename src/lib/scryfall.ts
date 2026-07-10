const CACHE_KEY = 'goldfish-cards-v3';
const OLD_CACHE_KEYS = ['goldfish-typelines-v1', 'goldfish-cards-v2'];
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
}

/** Compact localStorage form of CardData. */
interface CacheEntry {
  t: string;
  n?: string;
  m?: string[];
  c?: number;
  mc?: string;
  i?: string[];
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
  };
}

function toEntry(data: CardData): CacheEntry {
  const entry: CacheEntry = { t: data.typeLine };
  if (data.oracleName) entry.n = data.oracleName;
  if (data.producedMana.length) entry.m = data.producedMana;
  if (data.manaValue !== null) entry.c = data.manaValue;
  if (data.manaCost !== null) entry.mc = data.manaCost;
  if (data.colorIdentity.length) entry.i = data.colorIdentity;
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
  card_faces?: { name: string; type_line?: string; mana_cost?: string }[];
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

/**
 * Resolve card names to card data via Scryfall's collection endpoint,
 * consulting the localStorage cache first. Reports progress as batches land.
 */
export async function resolveCards(
  names: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ResolveResult> {
  const cache = loadCache();
  const cards = new Map<string, CardData>();
  const missing: string[] = [];

  for (const name of new Set(names.map(normalizeName))) {
    if (cache[name]) cards.set(name, fromEntry(cache[name]));
    else missing.push(name);
  }

  const notFound: string[] = [];
  let fetched = 0;

  // Store under both the full and front-face oracle names (so either form in
  // a future paste hits the cache), plus any extra keys (the requested name,
  // when it was a flavor name and differs from the oracle name).
  const record = (card: ScryfallCard, ...extraKeys: string[]) => {
    const cardData = toCardData(card);
    const keys = new Set([
      normalizeName(card.name),
      normalizeName(card.name.split('//')[0]),
      ...extraKeys.map(normalizeName),
    ]);
    for (const key of keys) {
      cache[key] = toEntry(cardData);
      cards.set(key, cardData);
    }
  };

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    if (i > 0) await sleep(BATCH_DELAY_MS);

    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: SCRYFALL_HEADERS,
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    });
    if (!res.ok) throw new Error(`Scryfall request failed (${res.status})`);
    const data: { data: ScryfallCard[]; not_found?: { name: string }[] } =
      await res.json();

    for (const card of data.data) record(card);

    // Second chance for names the batch endpoint can't match: flavor names
    // resolve through /cards/named.
    for (const miss of data.not_found ?? []) {
      await sleep(BATCH_DELAY_MS);
      const card = await resolveByNamed(miss.name);
      if (card) record(card, miss.name);
      else notFound.push(miss.name);
    }

    fetched += batch.length;
    onProgress?.(names.length - missing.length + fetched, names.length);
  }

  if (missing.length > 0) saveCache(cache);
  return { cards, notFound };
}
