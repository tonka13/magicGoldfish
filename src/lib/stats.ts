import { emptyTypeCounts } from './classify';
import { hasCastableCurve } from './curve';
import { countManaSources, producersCounted } from './mana';
import type { BatchStats, Card, CardType, HandAnalysis, KeepableConfig } from './types';

export const DEFAULT_KEEPABLE: KeepableConfig = {
  minSources: 3,
  maxLands: 4,
  countDorks: true,
  countRocks: true,
  minLands: 2,
  maxProducerMV: 3,
  requireCurve: true,
};

/**
 * A hand is keepable when it has enough mana sources to develop, isn't
 * flooded, has a floor of actual lands if dorks/rocks are doing some of the
 * work — and (optionally) can actually cast a turn 1–3 curve with the
 * colors its sources produce.
 */
export function analyzeHand(cards: Card[], config: KeepableConfig): HandAnalysis {
  const typeCounts = emptyTypeCounts();
  for (const card of cards) typeCounts[card.primaryType]++;

  const sources = countManaSources(cards, config);
  const landFloor = producersCounted(config) ? config.minLands : config.minSources;
  const manaOk =
    sources.total >= config.minSources &&
    sources.lands <= config.maxLands &&
    sources.lands >= landFloor;
  const curvesOut = hasCastableCurve(cards, config);

  return {
    landCount: sources.lands,
    manaSources: sources.total,
    typeCounts,
    manaOk,
    curvesOut,
    keepable: manaOk && (!config.requireCurve || curvesOut),
  };
}

export function summarizeBatch(hands: Card[][], config: KeepableConfig): BatchStats {
  const handCount = hands.length;
  const totals = emptyTypeCounts();
  const landDistribution = new Array(8).fill(0);
  let keepable = 0;
  let curvesOut = 0;
  let totalLands = 0;
  let totalSources = 0;

  for (const hand of hands) {
    const analysis = analyzeHand(hand, config);
    totalLands += analysis.landCount;
    totalSources += analysis.manaSources;
    landDistribution[Math.min(analysis.landCount, 7)]++;
    if (analysis.keepable) keepable++;
    if (analysis.curvesOut) curvesOut++;
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
    avgManaSources: handCount ? totalSources / handCount : 0,
    keepablePct: handCount ? (keepable / handCount) * 100 : 0,
    curveOutPct: handCount ? (curvesOut / handCount) * 100 : 0,
    config,
    avgTypeCounts,
    landDistribution,
  };
}
