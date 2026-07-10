import { describeKeepable, producersCounted } from './mana';
import { analyzeHand, summarizeBatch } from './stats';
import { CARD_TYPES } from './types';
import type { Card, DrawnHand, KeepableConfig } from './types';

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(...fields: (string | number)[]): string {
  return fields.map(csvField).join(',');
}

/** Types worth a CSV column (Unknown included only if it ever occurs). */
function activeTypes(hands: Card[][]) {
  const anyUnknown = hands.some((h) => h.some((c) => c.primaryType === 'Unknown'));
  return CARD_TYPES.filter((t) => t !== 'Unknown' || anyUnknown);
}

export function handsToCsv(hands: DrawnHand[], config: KeepableConfig): string {
  const cardLists = hands.map((h) => h.cards);
  const types = activeTypes(cardLists);
  const lines: string[] = [];

  lines.push(
    row('Hand #', 'Cards', 'Mulligans', ...types, 'Lands', 'Mana sources', 'Keepable'),
  );

  hands.forEach((hand, i) => {
    const analysis = analyzeHand(hand.cards, config);
    lines.push(
      row(
        i + 1,
        hand.cards.map((c) => c.name).join('; '),
        hand.mulligans,
        ...types.map((t) => analysis.typeCounts[t]),
        analysis.landCount,
        analysis.manaSources,
        analysis.keepable ? 'Y' : 'N',
      ),
    );
  });

  const stats = summarizeBatch(cardLists, config);
  lines.push('');
  lines.push(row('Summary'));
  lines.push(row('Keepable definition', describeKeepable(config)));
  lines.push(row('Hands drawn', stats.handCount));
  lines.push(row('Average lands per hand', stats.avgLands.toFixed(2)));
  if (producersCounted(config)) {
    lines.push(row('Average mana sources per hand', stats.avgManaSources.toFixed(2)));
  }
  lines.push(row('Keepable hands', `${stats.keepablePct.toFixed(1)}%`));
  for (const type of types) {
    lines.push(row(`Average ${type}s per hand`, stats.avgTypeCounts[type].toFixed(2)));
  }
  lines.push(
    row(
      'Land count distribution',
      stats.landDistribution.map((count, n) => `${n}: ${count}`).join('; '),
    ),
  );

  return lines.join('\r\n');
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
