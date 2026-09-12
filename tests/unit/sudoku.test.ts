import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { fullGrid, generatePuzzle } from '../../src/games/sudoku/generate';
import {
  CELLS, SIZE, conflicts, countSolutions, nextStep, peersOf, rate, solve,
} from '../../src/games/sudoku/solver';
import { sudokuSpec, type SudokuState } from '../../src/games/sudoku/def';

const rng = (seed = 5) => createRng(seed);

const isValidGrid = (g: number[]): boolean => {
  for (let i = 0; i < CELLS; i++) {
    const v = g[i];
    if (!v || v < 1 || v > SIZE) return false;
    for (const p of peersOf(i)) if (g[p] === v) return false;
  }
  return true;
};

describe('solver', () => {
  it('builds a complete, valid grid', () => {
    expect(isValidGrid(fullGrid(rng()))).toBe(true);
  });

  it('counts solutions and stops at the limit', () => {
    const full = fullGrid(rng());
    expect(countSolutions(full, 2)).toBe(1);

    const empty = new Array<number>(CELLS).fill(0);
    expect(countSolutions(empty, 2)).toBe(2);      // stopped early, as intended
  });

  it('solves a carved puzzle back to its solution', () => {
    const { puzzle, solution } = generatePuzzle(rng(11), 'easy');
    expect(solve(puzzle)).toEqual(solution);
  });

  it('spots conflicting digits', () => {
    const g = new Array<number>(CELLS).fill(0);
    g[0] = 5; g[1] = 5;
    const bad = conflicts(g);
    expect(bad.has(0)).toBe(true);
    expect(bad.has(1)).toBe(true);
    expect(bad.has(2)).toBe(false);
  });
});

describe('generation is fair', () => {
  it.each(['easy', 'medium', 'hard'])('%s puzzles have exactly one solution', (difficulty) => {
    const r = rng(2026);
    for (let i = 0; i < 6; i++) {
      const { puzzle, solution, technique } = generatePuzzle(r, difficulty);

      expect(countSolutions(puzzle, 2), 'a second solution would force guessing').toBe(1);
      expect(isValidGrid(solution)).toBe(true);

      // every given must agree with the solution
      for (let c = 0; c < CELLS; c++) {
        if (puzzle[c] !== 0) expect(puzzle[c]).toBe(solution[c]);
      }

      // must be solvable by the techniques the hint can actually explain
      expect(technique).not.toBe('none');
      expect(rate(puzzle)).not.toBe('none');
    }
  });

  it('gives harder levels fewer clues', () => {
    const r = rng(99);
    const easy = generatePuzzle(r, 'easy').clues;
    const hard = generatePuzzle(r, 'hard').clues;
    expect(hard).toBeLessThanOrEqual(easy);
  });

  it('is reproducible from its seed', () => {
    expect(generatePuzzle(rng(7), 'medium').puzzle)
      .toEqual(generatePuzzle(rng(7), 'medium').puzzle);
  });
});

describe('sudoku rules', () => {
  const fresh = (d = 'easy'): SudokuState => sudokuSpec.create(rng(3), d);

  it('has no losing condition', () => {
    expect(sudokuSpec.hasLoss).toBe(false);
    expect(sudokuSpec.isLost).toBeUndefined();
  });

  it('scores only correct entries, and re-typing earns nothing', () => {
    const s = fresh();
    const blank = s.puzzle.findIndex((v) => v === 0);
    expect(sudokuSpec.score(s)).toBe(0);

    s.entries[blank] = s.solution[blank]!;
    const scored = sudokuSpec.score(s);
    expect(scored).toBe(12);

    // same digit again, and a wrong one, must not add anything
    s.entries[blank] = s.solution[blank]!;
    expect(sudokuSpec.score(s)).toBe(scored);
    s.entries[blank] = ((s.solution[blank]! % 9) + 1);
    expect(sudokuSpec.score(s)).toBe(0);
  });

  it('wins only when every cell matches the solution', () => {
    const s = fresh();
    expect(sudokuSpec.isWon(s)).toBe(false);
    for (let i = 0; i < CELLS; i++) {
      if (s.puzzle[i] === 0) s.entries[i] = s.solution[i]!;
    }
    expect(sudokuSpec.isWon(s)).toBe(true);
  });

  it('hints a provable cell and names the technique', () => {
    const s = fresh();
    const hint = sudokuSpec.hint(s);
    expect(hint).not.toBeNull();
    expect(hint!.kind).toBe('cell');
    if (hint!.kind === 'cell') {
      expect(hint!.message).toBeTruthy();
      const step = nextStep(s.puzzle.slice());
      expect(step).not.toBeNull();
      expect(s.solution[hint!.index]).toBe(step!.value);
    }
  });

  it('locks the givens', () => {
    const s = fresh();
    const given = s.puzzle.findIndex((v) => v !== 0);
    const view = sudokuSpec.cell(s, given);
    expect(view.cls).toContain('given');
  });
});
