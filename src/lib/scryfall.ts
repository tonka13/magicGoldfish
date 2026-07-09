const CACHE_KEY = 'goldfish-typelines-v1';
const BATCH_SIZE = 75; // Scryfall /cards/collection limit
const BATCH_DELAY_MS = 120;

export interface ResolveResult {
  /** normalized name -> type_line */
  typeLines: Map<string, string>;
  notFound: string[];
}

export function normalizeName(name: string): string {
  // Front face only: pastes often have just "Delver of Secrets" for DFCs.
  return name.split('//')[0].trim().toLowerCase();
}

function loadCache(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>) {
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
  type_line?: string;
  card_faces?: { name: string; type_line?: string }[];
}

/**
 * Resolve card names to type lines via Scryfall's collection endpoint,
 * consulting the localStorage cache first. Reports progress as batches land.
 */
export async function resolveTypeLines(
  names: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ResolveResult> {
  const cache = loadCache();
  const typeLines = new Map<string, string>();
  const missing: string[] = [];

  for (const name of new Set(names.map(normalizeName))) {
    if (cache[name]) typeLines.set(name, cache[name]);
    else missing.push(name);
  }

  const notFound: string[] = [];
  let fetched = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    if (i > 0) await sleep(BATCH_DELAY_MS);

    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Scryfall requires an identifying UA; browsers drop this header and
        // send their own, which also passes.
        'User-Agent': 'CommanderGoldfish/1.0',
      },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    });
    if (!res.ok) throw new Error(`Scryfall request failed (${res.status})`);
    const data: { data: ScryfallCard[]; not_found?: { name: string }[] } =
      await res.json();

    for (const card of data.data) {
      const typeLine =
        card.type_line ?? card.card_faces?.[0]?.type_line ?? 'Unknown';
      // Key by both the full name and the front-face name so either form
      // in the paste hits the cache next time.
      cache[normalizeName(card.name)] = typeLine;
      const front = normalizeName(card.name.split('//')[0]);
      cache[front] = typeLine;
      typeLines.set(front, typeLine);
      typeLines.set(normalizeName(card.name), typeLine);
    }
    for (const miss of data.not_found ?? []) {
      notFound.push(miss.name);
    }

    fetched += batch.length;
    onProgress?.(names.length - missing.length + fetched, names.length);
  }

  if (missing.length > 0) saveCache(cache);
  return { typeLines, notFound };
}
