import { emptyTypeCounts } from './classify';
import type { BatchStats, Card, CardType, HandAnalysis } from './types';

export function analyzeHand(
  cards: Card[],
  keepableMin: number,
  keepableMax: number,
): HandAnalysis {
  const typeCounts = emptyTypeCounts();
  for (const card of cards) typeCounts[card.primaryType]++;
  const landCount = typeCounts.Land;
  return {
    landCount,
    typeCounts,
    keepable: landCount >= keepableMin && landCount <= keepableMax,
  };
}

export function summarizeBatch(
  hands: Card[][],
  keepableMin: number,
  keepableMax: number,
): BatchStats {
  const handCount = hands.length;
  const totals = emptyTypeCounts();
  const landDistribution = new Array(8).fill(0);
  let keepable = 0;
  let totalLands = 0;

  for (const hand of hands) {
    const analysis = analyzeHand(hand, keepableMin, keepableMax);
    totalLands += analysis.landCount;
    landDistribution[Math.min(analysis.landCount, 7)]++;
    if (analysis.keepable) keepable++;
    for (const type of Object.keys(totals) as CardType[]) {
      totals[type] += analysis.typeCounts[type];
    }
  }

  const avgTypeCounts = emptyTypeCounts();
  for (const type of Object.keys(totals) as CardType[]) {
    avgTypeCounts[type] = handCount ? totals[type] / handCount : 0;
  }

  return {
    handCount,
    avgLands: handCount ? totalLands / handCount : 0,
    keepablePct: handCount ? (keepable / handCount) * 100 : 0,
    keepableMin,
    keepableMax,
    avgTypeCounts,
    landDistribution,
  };
}
