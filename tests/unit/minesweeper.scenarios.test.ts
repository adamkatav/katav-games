import { describe, expect, it } from 'vitest';
import { createGridGame } from '../../src/games/grid/model';
import { minesweeperSpec, type MinesweeperState } from '../../src/games/minesweeper/def';
import { neighbours } from '../../src/games/grid/layout';
import { createHarness } from './scenarios/harness';
import {
  buildMinesweeper, minesHarness, renderMinesweeper, runMinesScenarios, type MinesScenario,
} from './scenarios/grid';

/**
 * Minesweeper on the hardest board: Expert, 30x16, 99 mines.
 *
 * Every picture below sits in the top-left corner of that board and is sealed
 * by a wall of mines down its right-hand side and along its bottom, so a
 * cascade stays inside it and each case can say what the whole board looks like
 * afterwards.
 */
const HARD = 'hard';

/** The sealed box, untouched. */
const CLOSED = [
  '.....*',
  '.....*',
  '.....*',
  '.....*',
  '.....*',
  '******',
];

/** The same box fully opened — every cascade in here ends up at this picture. */
const OPENED = [
  '____2*',
  '____3*',
  '____3*',
  '____3*',
  '23335*',
  '******',
];

const SCENARIOS: readonly MinesScenario[] = [
  /* ---- revealing --------------------------------------------------------- */
  {
    name: 'a blank cell opens everything it touches, and stops at the numbers',
    given: CLOSED,
    when: (h) => { h.click(0, 0); },
    then: OPENED,
    score: 250, moves: 1, streak: 1, sound: 'place', toast: null,
  },
  {
    name: 'a numbered cell opens alone',
    given: CLOSED,
    when: (h) => { h.click(4, 0); },
    then: [
      '....2*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    score: 10, moves: 1, sound: 'place',
  },
  {
    name: 'stepping on a mine ends the round, and uncovers only that mine',
    given: CLOSED,
    when: (h) => { h.click(5, 0); },
    then: [
      '.....X',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 1, outcome: 'lost', sound: 'bad',
  },

  /* ---- flags ------------------------------------------------------------- */
  {
    name: 'a right-click flags without leaving reveal mode',
    given: CLOSED,
    when: (h) => {
      h.secondary(5, 0);
      expect(h.state.mode, 'the accelerator must not change the mode').toBe('reveal');
    },
    then: [
      '.....F',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 1, sound: 'flip',
  },
  {
    name: 'a flag is its own undo, which is why this game has no undo button',
    given: CLOSED,
    when: (h) => { h.secondary(5, 0); h.secondary(5, 0); },
    then: CLOSED,
    moves: 2, canUndo: false,
  },
  {
    name: 'the toolbar mode switch flags without needing a second mouse button',
    given: CLOSED,
    when: (h) => { h.setMode('flag'); h.click(5, 0); },
    then: [
      '.....F',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 1, sound: 'flip',
  },
  {
    name: 'a flagged cell will not open, and the refusal says why',
    given: [
      'f....*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.click(0, 0); },
    then: [
      'f....*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 0, sound: 'bad', toast: /דגל/,
  },

  /* ---- chording ----------------------------------------------------------- */
  {
    name: 'a satisfied number opens everything its flags do not account for',
    given: [
      '....2F',
      '.....F',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.click(4, 0); },
    then: [
      '____2F',
      '____3F',
      '____3*',
      '____3*',
      '23335*',
      '******',
    ],
    // 25 cells opened at 10, two correct flags at 15.
    score: 280, moves: 1, sound: 'place',
  },
  {
    name: 'chording on a flag that was wrong is fatal, as it should be',
    given: [
      '...f2F',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.click(4, 0); },
    then: [
      '...f2F',
      '.....X',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 1, outcome: 'lost', sound: 'bad',
  },
  {
    name: 'a number with too few flags does nothing at all',
    given: [
      '....2F',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.click(4, 0); },
    then: [
      '....2F',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 0,
  },
  {
    name: 'a number with no flags at all does nothing either',
    given: [
      '....2*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.click(4, 0); },
    then: [
      '....2*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    moves: 0,
  },

  /* ---- what the score is made of ------------------------------------------ */
  {
    name: 'a flag on a mine is worth more than the cell it covers',
    given: [
      '....2*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.secondary(5, 0); },
    then: [
      '....2F',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    score: 25, moves: 1, streak: 1,
  },
  {
    name: 'a flag on a safe cell earns nothing, and costs nothing',
    given: [
      '....2*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    when: (h) => { h.secondary(0, 0); },
    then: [
      'f...2*',
      '.....*',
      '.....*',
      '.....*',
      '.....*',
      '******',
    ],
    score: 10, moves: 1, streak: 0,
  },
];

describe('minesweeper (expert) — state, action, state', () => {
  runMinesScenarios(HARD, SCENARIOS);
});

describe('minesweeper (expert) — the first click', () => {
  it('generates a board around the click, never under it', () => {
    const def = createGridGame(minesweeperSpec);
    const h = createHarness(def, { difficulty: HARD, seed: 7 });

    expect(h.state.cols).toBe(30);
    expect(h.state.rows).toBe(16);
    expect(h.state.mineCount).toBe(99);
    expect(h.state.started, 'no board exists until the player commits to a cell').toBe(false);
    expect(h.state.mines).toEqual([]);

    const first = 8 * 30 + 15;              // somewhere in the middle
    minesweeperSpec.onCell(h.state, first, h.session, false);

    expect(h.state.started).toBe(true);
    expect(h.state.mines).toHaveLength(99);
    expect(h.state.dead, 'the first click can never be a mine').toBeNull();
    for (const n of [first, ...neighbours(first, 30, 16)]) {
      expect(h.state.mines, `cell ${n} touches the first click`).not.toContain(n);
    }
    expect(
      h.state.revealed.filter(Boolean).length,
      'the opening must cascade, not uncover one lonely cell',
    ).toBeGreaterThan(1);
  });
});

describe('minesweeper (expert) — hints', () => {
  const opened = { rows: OPENED };

  it('names the rule that proves the cell, rather than just pointing', () => {
    const h = minesHarness(HARD, opened);
    expect(h.hint()).toEqual({
      kind: 'cell',
      index: 5,                              // the mine at the top of the wall
      message: expect.stringContaining('מוקש'),
    });
  });

  /**
   * A flag in the wrong place poisons every deduction that leans on it. Here
   * two safe cells are flagged next to a 2, which satisfies it, and the "safe"
   * cells it then hands out include a live mine. A hint that gets the player
   * killed breaks the one promise this game makes.
   */
  it('never calls a mine safe, even when the player has flagged the wrong cells', () => {
    const h = minesHarness(HARD, {
      rows: [
        '...f2*',
        '...f.*',
        '.....*',
        '.....*',
        '.....*',
        '******',
      ],
    });
    const hint = h.hint();
    expect(hint).not.toBeNull();
    const index = hint && 'index' in hint ? hint.index : -1;
    const message = hint && 'message' in hint ? hint.message ?? '' : '';

    if (/בטוח/.test(message)) {
      expect(h.state.mines, 'a cell called safe must actually be safe').not.toContain(index);
    }
    expect(message, 'the useful thing to say is that a flag is misplaced').toMatch(/דגל/);
    expect(index, 'and to point at the flag').toBe(h.index(3, 0));
  });

  it('says nothing before the board exists', () => {
    const def = createGridGame(minesweeperSpec);
    const h = createHarness(def, { difficulty: HARD, seed: 7 });
    expect(h.hint()).toBeNull();
  });

  it('says nothing once the round is lost', () => {
    const h = minesHarness(HARD, { rows: CLOSED });
    h.click(5, 0);
    expect(h.outcome).toBe('lost');
    expect(h.hint()).toBeNull();
  });
});

describe('minesweeper (expert) — what a loss looks like', () => {
  /** A flag on a safe cell, a flag on a mine, and a mine about to be trodden on. */
  const BEFORE_THE_BANG = [
    'f....F',
    '.....*',
    '.....*',
    '.....*',
    '.....*',
    '******',
  ];

  it('separates the mine that went off from the ninety-eight that did not', () => {
    const h = minesHarness(HARD, { rows: BEFORE_THE_BANG });
    h.click(5, 1);
    expect(h.outcome).toBe('lost');
    expect(h.state.dead).toBe(h.index(5, 1));

    const shown = (col: number, row: number) => minesweeperSpec.cell(h.state, h.index(col, row));

    expect(shown(5, 1).cls, 'the mine the player stepped on').toContain('blast');
    expect(shown(5, 2).cls, 'a mine that was never touched is not an explosion')
      .not.toContain('blast');
    expect(
      shown(5, 0).cls,
      'a flag that was right should be shown to have been right',
    ).toContain('found');
    expect(shown(0, 0), 'a flag that was wrong stays visible as a mistake')
      .toEqual({ text: '✗', cls: 'hidden wrong' });
  });

  it('leaves untouched mines covered-looking rather than all of them exploding', () => {
    const h = minesHarness(HARD, { rows: BEFORE_THE_BANG });
    h.click(5, 1);
    const blasts = h.state.mines.filter(
      (m) => minesweeperSpec.cell(h.state, m).cls?.includes('blast'),
    );
    expect(blasts, 'exactly one mine went off').toHaveLength(1);
  });
});

describe('minesweeper (expert) — finishing', () => {
  /** Every safe cell open but one: the position one click from a win. */
  const oneClickFromWinning = (): { state: MinesweeperState; last: number } => {
    const state = buildMinesweeper(HARD, { rows: CLOSED });
    const mines = new Set(state.mines);
    let last = -1;
    for (let i = 0; i < state.cols * state.rows; i++) {
      if (mines.has(i)) continue;
      if (last < 0) { last = i; continue; }     // leave the first safe cell shut
      state.revealed[i] = true;
    }
    return { state, last };
  };

  it('wins when the last safe cell opens, with mines still covered', () => {
    const { state, last } = oneClickFromWinning();
    const h = createHarness(createGridGame(minesweeperSpec), { difficulty: HARD, state });

    expect(h.outcome, 'one cell short is not a win').toBe('playing');
    minesweeperSpec.onCell(h.state, last, h.session, false);

    expect(h.outcome).toBe('won');
    expect(h.summary?.stars).toBeGreaterThanOrEqual(1);
    expect(h.state.dead).toBeNull();
    expect(
      h.state.mines.filter((m) => h.state.revealed[m]),
      'winning must not uncover the mines',
    ).toEqual([]);
  });

  it('counts down the mines as flags go on', () => {
    const h = minesHarness(HARD, { rows: CLOSED });
    expect(minesweeperSpec.stat?.(h.state)).toEqual({ label: 'מוקשים', value: '99' });
    h.secondary(5, 0);
    h.secondary(5, 1);
    expect(minesweeperSpec.stat?.(h.state)).toEqual({ label: 'מוקשים', value: '97' });
  });

  it('has no undo, because a revealed cell cannot honestly be taken back', () => {
    const h = minesHarness(HARD, { rows: CLOSED });
    h.click(0, 0);
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBe(false);
    expect(renderMinesweeper(h.state, { rows: OPENED })).toEqual(OPENED);
  });
});
