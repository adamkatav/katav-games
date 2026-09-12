import type { Rng } from '../../core/types';
import { CELLS, SIZE, candidates, countSolutions, rate, type Grid, type Technique } from './solver';

/**
 * Generation in two halves: fill a complete grid by backtracking, then remove
 * clues one at a time, keeping a clue whenever taking it out would leave more
 * than one solution. A puzzle with two answers would force a guess, which is
 * the same unfairness the Minesweeper generator exists to prevent.
 *
 * Difficulty comes from which techniques the puzzle needs, not from how many
 * clues are left — clue count is a poor proxy.
 */

export interface Puzzle {
  readonly puzzle: Grid;
  readonly solution: Grid;
  readonly technique: Technique;
  readonly clues: number;
}

export function fullGrid(rng: Rng): Grid {
  const grid: Grid = new Array<number>(CELLS).fill(0);

  const recurse = (): boolean => {
    let best = -1, bestOptions: number[] = [];
    for (let i = 0; i < CELLS; i++) {
      if (grid[i]) continue;
      const options = candidates(grid, i);
      if (options.length === 0) return false;
      if (best === -1 || options.length < bestOptions.length) {
        best = i; bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) return true;

    for (const v of rng.shuffle(bestOptions.slice())) {
      grid[best] = v;
      if (recurse()) return true;
      grid[best] = 0;
    }
    return false;
  };

  recurse();
  return grid;
}

/** Remove clues while the solution stays unique. */
function carve(solution: Grid, rng: Rng, keepAtLeast: number): Grid {
  const puzzle = solution.slice();
  const order = rng.shuffle(Array.from({ length: CELLS }, (_, i) => i));
  let clues = CELLS;

  for (const i of order) {
    if (clues <= keepAtLeast) break;
    const saved = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = saved;   // would be ambiguous
    else clues--;
  }
  return puzzle;
}

const TARGET: Record<string, { technique: Technique[]; keepAtLeast: number }> = {
  easy: { technique: ['naked-single'], keepAtLeast: 40 },
  medium: { technique: ['naked-single', 'hidden-single'], keepAtLeast: 32 },
  hard: { technique: ['hidden-single'], keepAtLeast: 26 },
};

export function generatePuzzle(rng: Rng, difficulty = 'easy'): Puzzle {
  const target = TARGET[difficulty] ?? TARGET['easy']!;

  let fallback: Puzzle | null = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const solution = fullGrid(rng);
    const puzzle = carve(solution, rng, target.keepAtLeast);
    const technique = rate(puzzle);
    const clues = puzzle.filter((v) => v !== 0).length;
    const candidate: Puzzle = { puzzle, solution, technique, clues };

    // 'none' means it needs techniques beyond what the hint can explain, which
    // would leave a player stuck with a hint button that cannot help.
    if (technique === 'none') continue;
    fallback ??= candidate;
    if (target.technique.includes(technique)) return candidate;
  }

  return fallback ?? (() => {
    const solution = fullGrid(rng);
    return { puzzle: solution.slice(), solution, technique: 'naked-single', clues: CELLS };
  })();
}

export { SIZE };
