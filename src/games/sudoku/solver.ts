/**
 * Sudoku solving and rating.
 *
 * Two jobs: count solutions (a puzzle with two answers would force guessing,
 * the same unfairness Minesweeper generation exists to prevent), and work out
 * which techniques a puzzle actually needs — clue count is a poor proxy for
 * difficulty, so the rating comes from how it is solved.
 */

export type Grid = number[];          // 81 cells, 0 = empty
export const SIZE = 9;
export const CELLS = 81;

export const rowOf = (i: number): number => Math.floor(i / SIZE);
export const colOf = (i: number): number => i % SIZE;
export const boxOf = (i: number): number =>
  Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** The 20 cells that share a row, column or box with `i`. */
export const peersOf = (() => {
  const cache: number[][] = [];
  for (let i = 0; i < CELLS; i++) {
    const peers = new Set<number>();
    for (let j = 0; j < CELLS; j++) {
      if (j === i) continue;
      if (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)) peers.add(j);
    }
    cache.push([...peers]);
  }
  return (i: number): readonly number[] => cache[i]!;
})();

export function isLegal(grid: Grid, index: number, value: number): boolean {
  for (const p of peersOf(index)) if (grid[p] === value) return false;
  return true;
}

/** Cells that conflict with a peer holding the same digit. */
export function conflicts(grid: Grid): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    const v = grid[i];
    if (!v) continue;
    for (const p of peersOf(i)) {
      if (grid[p] === v) { bad.add(i); bad.add(p); }
    }
  }
  return bad;
}

export const candidates = (grid: Grid, index: number): number[] => {
  if (grid[index]) return [];
  const used = new Set<number>();
  for (const p of peersOf(index)) { const v = grid[p]; if (v) used.add(v); }
  const out: number[] = [];
  for (let v = 1; v <= SIZE; v++) if (!used.has(v)) out.push(v);
  return out;
};

/**
 * Count solutions, stopping at `limit`. Uniqueness only ever needs limit 2,
 * so the true count is never computed.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const work = grid.slice();
  let found = 0;

  const recurse = (): void => {
    if (found >= limit) return;

    // branch on the most constrained cell, which prunes hardest
    let best = -1, bestOptions: number[] = [];
    for (let i = 0; i < CELLS; i++) {
      if (work[i]) continue;
      const options = candidates(work, i);
      if (options.length === 0) return;           // dead end
      if (best === -1 || options.length < bestOptions.length) {
        best = i; bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) { found++; return; }         // every cell filled

    for (const v of bestOptions) {
      work[best] = v;
      recurse();
      work[best] = 0;
      if (found >= limit) return;
    }
  };

  recurse();
  return found;
}

export function solve(grid: Grid): Grid | null {
  const work = grid.slice();
  const recurse = (): boolean => {
    let best = -1, bestOptions: number[] = [];
    for (let i = 0; i < CELLS; i++) {
      if (work[i]) continue;
      const options = candidates(work, i);
      if (options.length === 0) return false;
      if (best === -1 || options.length < bestOptions.length) {
        best = i; bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) return true;
    for (const v of bestOptions) {
      work[best] = v;
      if (recurse()) return true;
      work[best] = 0;
    }
    return false;
  };
  return recurse() ? work : null;
}

/* ---- human techniques, for rating and for hints ------------------------- */

export type Technique = 'naked-single' | 'hidden-single' | 'pointing' | 'none';

export interface Step {
  readonly index: number;
  readonly value: number;
  readonly technique: Technique;
}

/** One cell a person could fill next, with the reason. */
export function nextStep(grid: Grid): Step | null {
  // A cell with only one candidate left.
  for (let i = 0; i < CELLS; i++) {
    if (grid[i]) continue;
    const options = candidates(grid, i);
    if (options.length === 1) {
      return { index: i, value: options[0]!, technique: 'naked-single' };
    }
  }

  // A digit with only one place left in a row, column or box.
  const units: number[][] = [];
  for (let u = 0; u < SIZE; u++) {
    const row: number[] = [], col: number[] = [], box: number[] = [];
    for (let k = 0; k < SIZE; k++) {
      row.push(u * SIZE + k);
      col.push(k * SIZE + u);
      box.push((Math.floor(u / 3) * 3 + Math.floor(k / 3)) * SIZE + (u % 3) * 3 + (k % 3));
    }
    units.push(row, col, box);
  }

  for (const unit of units) {
    for (let v = 1; v <= SIZE; v++) {
      if (unit.some((i) => grid[i] === v)) continue;
      const spots = unit.filter((i) => !grid[i] && candidates(grid, i).includes(v));
      if (spots.length === 1) {
        return { index: spots[0]!, value: v, technique: 'hidden-single' };
      }
    }
  }

  return null;
}

/** Hardest technique the puzzle needs, or 'none' if singles alone cannot finish it. */
export function rate(puzzle: Grid): Technique {
  const work = puzzle.slice();
  let hardest: Technique = 'naked-single';

  for (;;) {
    if (work.every((v) => v !== 0)) return hardest;
    const step = nextStep(work);
    if (!step) return 'none';                    // needs more than we teach
    if (step.technique === 'hidden-single' && hardest === 'naked-single') {
      hardest = 'hidden-single';
    }
    work[step.index] = step.value;
  }
}
