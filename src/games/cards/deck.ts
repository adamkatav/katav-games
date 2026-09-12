import type { Rng } from '../../core/types';

export type Suit = 0 | 1 | 2 | 3;          // ♠ ♥ ♦ ♣
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  readonly id: number;
  readonly rank: Rank;
  readonly suit: Suit;
  up: boolean;
}

export const SUIT_GLYPH = ['♠', '♥', '♦', '♣'] as const;
export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export const isRed = (c: Card): boolean => c.suit === 1 || c.suit === 2;

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/** `copies` full decks of the given suits. */
export function buildDeck(suits: readonly Suit[], copies: number): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (let c = 0; c < copies; c++) {
    for (const suit of suits) {
      for (const rank of RANKS) cards.push({ id: id++, rank, suit, up: false });
    }
  }
  return cards;
}

export const standardDeck = (rng: Rng): Card[] =>
  rng.shuffle(buildDeck([0, 1, 2, 3], 1));

/* ---- pile helpers ------------------------------------------------------- */

export type PileId = string;
export type Piles = Record<PileId, Card[]>;

export const ids = (prefix: string, n: number): PileId[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

export const topOf = (piles: Piles, pile: PileId): Card | undefined => {
  const a = piles[pile];
  return a && a.length > 0 ? a[a.length - 1] : undefined;
};

export const isEmpty = (piles: Piles, pile: PileId): boolean => (piles[pile]?.length ?? 0) === 0;

/* ---- run predicates ----------------------------------------------------- */

/** descending rank, alternating colour — Klondike and FreeCell tableaux */
export function isAlternatingRun(run: readonly Card[]): boolean {
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1]!, b = run[i]!;
    if (b.rank !== a.rank - 1 || isRed(a) === isRed(b)) return false;
  }
  return true;
}

/** descending rank, same suit — Spider runs and completed sets */
export function isSameSuitRun(run: readonly Card[]): boolean {
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1]!, b = run[i]!;
    if (b.rank !== a.rank - 1 || b.suit !== a.suit) return false;
  }
  return true;
}
