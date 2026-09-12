import { createRng } from '../../core/rng';
import { neighbours } from '../grid/layout';
import { isSolvable } from './solver';

/**
 * Mines are placed only after the first click, and only on a board the solver
 * can clear by logic alone. Together those two rules mean a player never loses
 * to an opening coin-flip, and never to a position with no deduction available
 * — so every loss is a mistake they could have avoided.
 *
 * Pure in (seed, firstClick): undo and resume rebuild the same board.
 */

const MAX_ATTEMPTS = 200;

export interface BoardSpec {
  readonly cols: number;
  readonly rows: number;
  readonly mineCount: number;
}

export interface GenerationResult {
  readonly mines: number[];
  /** false when we ran out of attempts and fell back to a merely-safe board */
  readonly fair: boolean;
  readonly attempts: number;
}

function pickMines(
  rng: { int(n: number): number }, total: number, count: number, forbidden: Set<number>,
): number[] {
  const pool: number[] = [];
  for (let i = 0; i < total; i++) if (!forbidden.has(i)) pool.push(i);
  // partial Fisher-Yates: we only need the first `count`
  for (let i = 0; i < count && i < pool.length; i++) {
    const j = i + rng.int(pool.length - i);
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

export function generateBoard(
  spec: BoardSpec, seed: number, firstClick: number,
): GenerationResult {
  const { cols, rows, mineCount } = spec;
  const total = cols * rows;

  // The first click and everything touching it stay clear, so the opening
  // always cascades instead of ending the game on move one.
  const forbidden = new Set<number>([firstClick, ...neighbours(firstClick, cols, rows)]);
  const capacity = total - forbidden.size;
  const count = Math.min(mineCount, capacity);

  const rng = createRng(seed);
  let fallback: number[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const mines = pickMines(rng, total, count, forbidden);
    fallback = mines;
    if (isSolvable({ cols, rows, mines: new Set(mines) }, firstClick)) {
      return { mines, fair: true, attempts: attempt };
    }
  }

  // Never hang: a safe-but-possibly-guessy board beats a frozen game.
  return { mines: fallback, fair: false, attempts: MAX_ATTEMPTS };
}
