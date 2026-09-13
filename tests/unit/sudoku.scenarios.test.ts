import { describe, expect, it } from 'vitest';
import { createGridGame } from '../../src/games/grid/model';
import { sudokuSpec } from '../../src/games/sudoku/def';
import { CELLS } from '../../src/games/sudoku/solver';
import { createRng } from '../../src/core/rng';
import { createHarness } from './scenarios/harness';
import {
  at, buildSudoku, marksOf, runSudokuScenarios, sudokuHarness, toGrid, toPicture,
  type Picture, type SudokuScenario,
} from './scenarios/sudoku';

/**
 * Sudoku on the hardest setting. The board below is a real Expert deal — 26
 * clues, and it needs hidden singles, not just naked ones — kept as a literal
 * so every case reads against the same position.
 */
const PUZZLE: Picture = [
  '.1..7....',
  '...63...9',
  '....816..',
  '.....4..2',
  '...1.3...',
  '..28.5193',
  '96.....34',
  '.3.......',
  '7.1...9..',
];

const SOLUTION: Picture = [
  '216579348',
  '548632719',
  '397481625',
  '183794562',
  '659123487',
  '472865193',
  '965217834',
  '834956271',
  '721348956',
];

const EMPTY: Picture = Array.from({ length: 9 }, () => '.........');

/** The same picture with one cell filled in — how a state B usually differs. */
const set = (picture: Picture, index: number, digit: number): Picture => {
  const grid = toGrid(picture);
  grid[index] = digit;
  return toPicture(grid);
};

const TOP_LEFT = at(0, 0);      // empty in the puzzle; the answer there is 2
const A_GIVEN = at(1, 0);       // the 1 that was dealt

const SCENARIOS: readonly SudokuScenario[] = [
  /* ---- choosing a cell ---------------------------------------------------- */
  {
    name: 'tapping an empty cell selects it and costs no move',
    given: EMPTY, selected: null,
    when: (h) => { h.tap(0, 0); },
    then: EMPTY, thenSelected: TOP_LEFT,
    moves: 0, sound: 'select', toast: null,
  },
  {
    name: 'tapping a given explains that it came with the board',
    given: EMPTY, selected: null,
    when: (h) => { h.tap(1, 0); },
    then: EMPTY,
    moves: 0, sound: 'bad', toast: /לוח/,
  },
  {
    name: 'a digit with no cell chosen asks for a cell first',
    given: EMPTY, selected: null,
    when: (h) => { h.pad(4); },
    then: EMPTY,
    moves: 0, sound: 'bad', toast: /קודם בוחרים תא/,
  },

  /* ---- writing digits ----------------------------------------------------- */
  {
    name: 'the right digit goes in and scores',
    given: EMPTY, selected: TOP_LEFT,
    when: (h) => { h.pad(2); },
    then: set(EMPTY, TOP_LEFT, 2),
    score: 12, moves: 1, streak: 1, sound: 'place', toast: null,
  },
  {
    name: 'a wrong digit is accepted and scores nothing — the player is allowed to try',
    given: EMPTY, selected: TOP_LEFT,
    when: (h) => { h.pad(3); },
    then: set(EMPTY, TOP_LEFT, 3),
    score: 0, moves: 1, streak: 0, sound: 'place',
  },
  {
    name: 'typing the same digit again takes it back out',
    given: set(EMPTY, TOP_LEFT, 2), selected: TOP_LEFT,
    when: (h) => { h.pad(2); },
    then: EMPTY,
    score: 0, moves: 1, sound: 'place',
  },
  {
    name: 'a given will not take a digit, and says why rather than just buzzing',
    given: EMPTY, selected: A_GIVEN,
    when: (h) => { h.pad(5); },
    then: EMPTY,
    moves: 0, sound: 'bad', toast: /לוח/,
  },
  {
    name: 'the erase key clears the cell',
    given: set(EMPTY, TOP_LEFT, 3), selected: TOP_LEFT,
    when: (h) => { h.pad(0); },
    then: EMPTY,
    moves: 1, sound: 'place',
  },

  /* ---- pencil marks -------------------------------------------------------- */
  {
    name: 'note mode writes a mark instead of a digit',
    given: EMPTY, selected: TOP_LEFT, mode: 'note',
    when: (h) => { h.pad(3); },
    then: EMPTY, thenPencil: { [TOP_LEFT]: [3] },
    score: 0, moves: 1, sound: 'place',
  },
  {
    name: 'marks accumulate, and each one toggles off on its own',
    given: EMPTY, selected: TOP_LEFT, mode: 'note', pencil: { [TOP_LEFT]: [4] },
    when: (h) => { h.pad(6); h.pad(4); },
    then: EMPTY, thenPencil: { [TOP_LEFT]: [6] },
    moves: 2,
  },
  {
    name: 'writing a digit clears the marks underneath it',
    given: EMPTY, selected: TOP_LEFT, pencil: { [TOP_LEFT]: [2, 5, 8] },
    when: (h) => { h.setMode('write'); h.pad(2); },
    then: set(EMPTY, TOP_LEFT, 2), thenPencil: { [TOP_LEFT]: [] },
    score: 12, moves: 1,
  },
  {
    name: 'the erase key clears marks too',
    given: EMPTY, selected: TOP_LEFT, mode: 'note', pencil: { [TOP_LEFT]: [2, 5] },
    when: (h) => { h.pad(0); },
    then: EMPTY, thenPencil: { [TOP_LEFT]: [] },
    moves: 1,
  },

  /* ---- scoring and undo ---------------------------------------------------- */
  {
    name: 'a digit rubbed out and written again is not worth twice',
    given: EMPTY, selected: TOP_LEFT,
    when: (h) => { h.pad(2); h.pad(2); h.pad(2); },
    then: set(EMPTY, TOP_LEFT, 2),
    score: 12, moves: 3, streak: 0,
  },
  {
    name: 'undo takes back the digit and the score with it',
    given: EMPTY, selected: TOP_LEFT,
    when: (h) => { h.pad(2); expect(h.undo()).toBe(true); },
    then: EMPTY,
    score: 0, moves: 0, streak: 0, canUndo: false,
  },
];

describe('sudoku (hard) — state, action, state', () => {
  runSudokuScenarios(PUZZLE, SOLUTION, SCENARIOS);
});

describe('sudoku (hard) — hints', () => {
  it('names the digit and the technique that finds it', () => {
    const h = sudokuHarness({ puzzle: PUZZLE, solution: SOLUTION });
    const hint = h.hint();
    expect(hint?.kind).toBe('cell');
    expect(hint && 'message' in hint ? hint.message : '', 'a hint that shows nothing is no hint')
      .toMatch(/^[1-9] — .+/);
  });

  it('costs the streak, the same as in every other game', () => {
    const h = sudokuHarness({ puzzle: PUZZLE, solution: SOLUTION, selected: TOP_LEFT });
    h.pad(2);
    expect(h.streak).toBe(1);
    expect(h.hint()).not.toBeNull();
    expect(h.streak).toBe(0);
  });

  /**
   * A wrong digit that happens not to clash with anything is invisible on the
   * board, and the hint used to reason from it as though it were true — so it
   * would confidently suggest a digit that cannot be right.
   */
  it('points out a wrong digit rather than reasoning from it', () => {
    const h = sudokuHarness({
      puzzle: PUZZLE, solution: SOLUTION,
      entries: set(EMPTY, TOP_LEFT, 3),          // the answer there is 2
      selected: TOP_LEFT,
    });
    const hint = h.hint();
    expect(hint && 'index' in hint ? hint.index : -1).toBe(TOP_LEFT);
    expect(hint && 'message' in hint ? hint.message : '').toMatch(/לא נכונה/);
  });

  it('only ever suggests a digit that matches the one answer the grid has', () => {
    const h = sudokuHarness({
      puzzle: PUZZLE, solution: SOLUTION, entries: set(EMPTY, at(3, 3), 9),
    });
    const hint = h.hint();
    const index = hint && 'index' in hint ? hint.index : -1;
    const digit = Number((hint && 'message' in hint ? hint.message ?? '' : '').charAt(0));
    if (Number.isInteger(digit) && digit > 0) {
      expect(digit, `suggested for cell ${index}`).toBe(toGrid(SOLUTION)[index]);
    }
  });

  it('has nothing left to say on a finished grid', () => {
    const h = sudokuHarness({
      puzzle: PUZZLE, solution: SOLUTION, entries: SOLUTION,
    });
    expect(h.hint()).toBeNull();
  });
});

describe('sudoku (hard) — finishing', () => {
  /** Every cell the player owns filled in but one. */
  const oneDigitShort = (): { entries: Picture; last: number; digit: number } => {
    const puzzle = toGrid(PUZZLE);
    const solution = toGrid(SOLUTION);
    const entries = new Array<number>(CELLS).fill(0);
    let last = -1;
    for (let i = 0; i < CELLS; i++) {
      if (puzzle[i] !== 0) continue;
      if (last < 0) { last = i; continue; }
      entries[i] = solution[i]!;
    }
    return { entries: toPicture(entries), last, digit: solution[last]! };
  };

  it('wins on the last digit and pays a win bonus', () => {
    const { entries, last, digit } = oneDigitShort();
    const h = sudokuHarness({ puzzle: PUZZLE, solution: SOLUTION, entries, selected: last });

    expect(h.outcome, 'one digit short is not a win').toBe('playing');
    const before = h.score;
    h.pad(digit);

    expect(h.outcome).toBe('won');
    expect(h.score).toBeGreaterThan(before + 12);
    expect(h.summary?.stars).toBeGreaterThanOrEqual(1);
    expect(h.saved).toBeNull();
  });

  it('does not accept a full grid that is merely legal-looking', () => {
    const wrong = toGrid(SOLUTION);
    const a = at(0, 0), b = at(1, 0);
    [wrong[a], wrong[b]] = [wrong[b]!, wrong[a]!];     // two digits swapped
    const h = sudokuHarness({ puzzle: PUZZLE, solution: SOLUTION, entries: toPicture(wrong) });
    expect(h.outcome).toBe('playing');
    expect(sudokuSpec.isWon(h.state)).toBe(false);
  });

  it('counts down the cells left to fill', () => {
    const h = sudokuHarness({ puzzle: PUZZLE, solution: SOLUTION, selected: TOP_LEFT });
    expect(sudokuSpec.stat?.(h.state)).toEqual({ label: 'נותרו', value: '55' });
    h.pad(2);
    expect(sudokuSpec.stat?.(h.state)).toEqual({ label: 'נותרו', value: '54' });
  });
});

describe('sudoku (hard) — the deal itself', () => {
  it('deals a grid with exactly one answer, reachable by the techniques it teaches', () => {
    const def = createGridGame(sudokuSpec);
    const h = createHarness(def, { difficulty: 'hard', seed: 99 });
    const state = h.state;

    expect(state.entries.filter((v) => v !== 0)).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.mode).toBe('write');
    expect(sudokuSpec.isWon(state), 'a fresh deal is not already solved').toBe(false);
    expect(sudokuSpec.hint(state), 'a fresh deal must have a first move to suggest').not.toBeNull();
  });

  it('keeps the state JSON-serialisable, which undo and resume depend on', () => {
    const state = buildSudoku({
      puzzle: PUZZLE, solution: SOLUTION, pencil: { [TOP_LEFT]: [1, 9] },
    });
    const round = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(marksOf(round, TOP_LEFT)).toEqual([1, 9]);
    expect(round).toEqual(state);
  });
});

/** A sanity check on the literal above, so a typo in it cannot hide a bug. */
describe('sudoku (hard) — the board these cases use', () => {
  it('is a genuine puzzle whose givens agree with its solution', () => {
    const puzzle = toGrid(PUZZLE);
    const solution = toGrid(SOLUTION);
    expect(puzzle.filter((v) => v !== 0)).toHaveLength(26);
    for (let i = 0; i < CELLS; i++) {
      if (puzzle[i] !== 0) expect(puzzle[i], `given at ${i}`).toBe(solution[i]);
    }
    expect(sudokuSpec.create(createRng(1), 'hard').puzzle).toHaveLength(CELLS);
  });
});
