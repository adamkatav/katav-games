import { expect, it } from 'vitest';
import { createGridGame } from '../../../src/games/grid/model';
import { placeDigit, sudokuSpec, type SudokuState } from '../../../src/games/sudoku/def';
import { CELLS, SIZE, type Grid } from '../../../src/games/sudoku/solver';
import { createHarness, checkRound, type Harness, type RoundExpectation } from './harness';

/**
 * A Sudoku position as three pictures: the givens, what the player has written,
 * and — where a case cares — the pencil marks.
 *
 *   '.1..7....'    '.' is an empty cell
 *
 * The givens and the solution come from a real generated Expert puzzle, so the
 * hint, the win check and the score all run against a board the game could
 * actually have dealt.
 */

export type Picture = readonly string[];

export const toGrid = (picture: Picture): Grid => {
  if (picture.length !== SIZE) throw new Error('a grid is nine rows');
  const out: Grid = [];
  for (const row of picture) {
    if (row.length !== SIZE) throw new Error(`not nine columns: "${row}"`);
    for (const ch of row) out.push(ch === '.' ? 0 : Number(ch));
  }
  return out;
};

export const toPicture = (grid: readonly number[]): string[] =>
  Array.from({ length: SIZE }, (_, r) =>
    grid.slice(r * SIZE, r * SIZE + SIZE).map((v) => (v === 0 ? '.' : String(v))).join(''));

export interface SudokuSetup {
  readonly puzzle: Picture;
  readonly solution: Picture;
  readonly entries?: Picture;
  /** digit sets per cell, as pictures of the cells that hold marks */
  readonly pencil?: Readonly<Record<number, readonly number[]>>;
  readonly selected?: number | null;
  readonly mode?: SudokuState['mode'];
}

export function buildSudoku(setup: SudokuSetup): SudokuState {
  const pencil = new Array<number>(CELLS).fill(0);
  for (const [index, digits] of Object.entries(setup.pencil ?? {})) {
    for (const d of digits) pencil[Number(index)]! |= 1 << (d - 1);
  }
  return {
    puzzle: toGrid(setup.puzzle),
    solution: toGrid(setup.solution),
    entries: setup.entries ? toGrid(setup.entries) : new Array<number>(CELLS).fill(0),
    pencil,
    selected: setup.selected ?? null,
    pad: 1,
    mode: setup.mode ?? 'write',
  };
}

/** The digits a cell's pencil marks hold, low to high. */
export const marksOf = (s: SudokuState, index: number): number[] => {
  const bits = s.pencil[index] ?? 0;
  const out: number[] = [];
  for (let d = 1; d <= SIZE; d++) if (bits & (1 << (d - 1))) out.push(d);
  return out;
};

export const at = (col: number, row: number): number => row * SIZE + col;

/* ---- the runner --------------------------------------------------------- */

export interface SudokuHarness extends Harness<SudokuState> {
  /** tap a cell */
  readonly tap: (col: number, row: number) => void;
  /** press a number-pad button; 0 is the erase key */
  readonly pad: (digit: number) => void;
  readonly setMode: (mode: SudokuState['mode']) => void;
  readonly entries: () => string[];
}

export interface SudokuScenario extends RoundExpectation {
  readonly name: string;
  /** state A — what the player has written so far */
  readonly given: Picture;
  readonly selected?: number | null;
  readonly mode?: SudokuState['mode'];
  readonly pencil?: Readonly<Record<number, readonly number[]>>;
  readonly when: (h: SudokuHarness) => void;
  /** state B */
  readonly then: Picture;
  readonly thenPencil?: Readonly<Record<number, readonly number[]>>;
  readonly thenSelected?: number | null;
}

export function sudokuHarness(setup: SudokuSetup): SudokuHarness {
  const def = createGridGame(sudokuSpec);
  const base = createHarness(def, { difficulty: 'hard', state: buildSudoku(setup) });

  return Object.assign(base, {
    tap: (col: number, row: number) =>
      sudokuSpec.onCell(base.state, at(col, row), base.session, false),
    pad: (digit: number) => { placeDigit(base.session, digit); },
    setMode: (mode: SudokuState['mode']) => {
      const button = sudokuSpec.toolbar?.(base.session, () => { /* redraw */ })
        .find((b) => b.id === (mode === 'write' ? 'write' : 'note'));
      if (!button) throw new Error(`no toolbar button for "${mode}"`);
      button.onClick();
    },
    entries: () => toPicture(base.state.entries),
  });
}

export function runSudokuScenarios(
  puzzle: Picture, solution: Picture, scenarios: readonly SudokuScenario[],
): void {
  for (const s of scenarios) {
    it(s.name, () => {
      const h = sudokuHarness({
        puzzle,
        solution,
        entries: s.given,
        ...(s.pencil ? { pencil: s.pencil } : {}),
        ...(s.selected !== undefined ? { selected: s.selected } : {}),
        ...(s.mode ? { mode: s.mode } : {}),
      });
      expect(h.entries(), 'the position must read back as it was written').toEqual([...s.given]);
      h.clear();

      s.when(h);

      expect(h.entries()).toEqual([...s.then]);
      if (s.thenPencil !== undefined) {
        for (const [index, digits] of Object.entries(s.thenPencil)) {
          expect(marksOf(h.state, Number(index)), `marks in cell ${index}`).toEqual([...digits]);
        }
      }
      if (s.thenSelected !== undefined) expect(h.state.selected).toBe(s.thenSelected);
      checkRound(h, s);
    });
  }
}
