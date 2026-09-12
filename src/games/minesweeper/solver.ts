import { neighbours } from '../grid/layout';

/**
 * A solver that only makes deductions a person makes. Its job is not to win —
 * it is to prove a board can be won *without guessing*, so every loss the
 * player suffers is attributable to a decision they could have made better.
 */

export interface Board {
  readonly cols: number;
  readonly rows: number;
  readonly mines: ReadonlySet<number>;
}

export type Deduction =
  | { rule: 'count'; index: number; safe: number[]; mines: number[] }
  | { rule: 'subset'; index: number; other: number; safe: number[]; mines: number[] }
  | { rule: 'total'; safe: number[]; mines: number[] };

const countAdjacent = (board: Board, index: number): number =>
  neighbours(index, board.cols, board.rows).filter((n) => board.mines.has(n)).length;

/**
 * One step of deduction from the current knowledge. Returns null when nothing
 * further can be concluded — which is exactly the "you must guess" position.
 */
export function deduce(
  board: Board, revealed: ReadonlySet<number>, flagged: ReadonlySet<number>,
): Deduction | null {
  const unknown = (i: number): boolean => !revealed.has(i) && !flagged.has(i);

  // Rule 1 — a revealed number against its own neighbourhood.
  for (const index of revealed) {
    const around = neighbours(index, board.cols, board.rows);
    const hidden = around.filter(unknown);
    if (hidden.length === 0) continue;
    const flags = around.filter((n) => flagged.has(n)).length;
    const need = countAdjacent(board, index) - flags;

    if (need === 0) return { rule: 'count', index, safe: hidden, mines: [] };
    if (need === hidden.length) return { rule: 'count', index, safe: [], mines: hidden };
  }

  // Rule 2 — one number's unknowns as a subset of another's. This is what
  // resolves the "obvious, but not from a single cell" positions.
  for (const a of revealed) {
    const aAround = neighbours(a, board.cols, board.rows);
    const aHidden = aAround.filter(unknown);
    if (aHidden.length === 0) continue;
    const aNeed = countAdjacent(board, a) - aAround.filter((n) => flagged.has(n)).length;

    for (const b of revealed) {
      if (a === b) continue;
      const bAround = neighbours(b, board.cols, board.rows);
      const bHidden = bAround.filter(unknown);
      if (bHidden.length === 0) continue;
      if (!aHidden.every((i) => bHidden.includes(i))) continue;   // a ⊆ b

      const bNeed = countAdjacent(board, b) - bAround.filter((n) => flagged.has(n)).length;
      const rest = bHidden.filter((i) => !aHidden.includes(i));
      if (rest.length === 0) continue;

      const diff = bNeed - aNeed;
      if (diff === 0) return { rule: 'subset', index: b, other: a, safe: rest, mines: [] };
      if (diff === rest.length) return { rule: 'subset', index: b, other: a, safe: [], mines: rest };
    }
  }

  // Rule 3 — the mines that are left, against the cells that are left.
  const hiddenAll: number[] = [];
  for (let i = 0; i < board.cols * board.rows; i++) if (unknown(i)) hiddenAll.push(i);
  const minesLeft = board.mines.size - flagged.size;
  if (hiddenAll.length > 0) {
    if (minesLeft === 0) return { rule: 'total', safe: hiddenAll, mines: [] };
    if (minesLeft === hiddenAll.length) return { rule: 'total', safe: [], mines: hiddenAll };
  }

  return null;
}

/** Reveal a cell and, when it is a zero, everything it opens up. */
export function flood(board: Board, revealed: Set<number>, index: number): void {
  if (board.mines.has(index) || revealed.has(index)) return;
  const stack = [index];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (revealed.has(i) || board.mines.has(i)) continue;
    revealed.add(i);
    if (countAdjacent(board, i) === 0) {
      for (const n of neighbours(i, board.cols, board.rows)) {
        if (!revealed.has(n) && !board.mines.has(n)) stack.push(n);
      }
    }
  }
}

/**
 * True when the board can be cleared from `firstClick` by logic alone.
 * This is the check that makes a loss always the player's own mistake.
 */
export function isSolvable(board: Board, firstClick: number): boolean {
  const revealed = new Set<number>();
  const flagged = new Set<number>();
  flood(board, revealed, firstClick);

  const total = board.cols * board.rows;
  for (;;) {
    if (revealed.size + board.mines.size === total) return true;

    const step = deduce(board, revealed, flagged);
    if (step === null) return false;               // a guess would be required

    for (const i of step.mines) flagged.add(i);
    for (const i of step.safe) flood(board, revealed, i);

    // deduce() always yields at least one new fact, so this terminates
  }
}

export const adjacentCount = countAdjacent;
