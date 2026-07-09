import type { Card } from './types';

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawHand(library: Card[], size = 7): Card[] {
  return shuffle(library).slice(0, Math.min(size, library.length));
}

export function drawBatch(library: Card[], count: number, size = 7): Card[][] {
  const hands: Card[][] = [];
  for (let i = 0; i < count; i++) hands.push(drawHand(library, size));
  return hands;
}

/**
 * London mulligan state for single-hand mode. Every mulligan draws a fresh 7;
 * on keep, the player bottoms (mulligans - freeMulligans) cards.
 */
export interface MulliganState {
  hand: Card[];
  mulligans: number;
  freeFirst: boolean;
  /** Cards the player must put on the bottom when keeping this hand. */
  toBottom: number;
}

export function newHand(library: Card[], freeFirst: boolean): MulliganState {
  return { hand: drawHand(library), mulligans: 0, freeFirst, toBottom: 0 };
}

export function takeMulligan(library: Card[], state: MulliganState): MulliganState {
  const mulligans = state.mulligans + 1;
  return {
    hand: drawHand(library),
    mulligans,
    freeFirst: state.freeFirst,
    toBottom: effectiveMulligans(mulligans, state.freeFirst),
  };
}

export function effectiveMulligans(mulligans: number, freeFirst: boolean): number {
  return freeFirst ? Math.max(0, mulligans - 1) : mulligans;
}

export function bottomCards(state: MulliganState, indices: number[]): Card[] {
  const drop = new Set(indices);
  return state.hand.filter((_, i) => !drop.has(i));
}
