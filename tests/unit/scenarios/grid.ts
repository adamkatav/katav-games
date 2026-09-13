import { expect, it } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { createGridGame } from '../../../src/games/grid/model';
import { adjacentCount } from '../../../src/games/minesweeper/solver';
import { minesweeperSpec, type MinesweeperState } from '../../../src/games/minesweeper/def';
import { createHarness, checkRound, type Harness, type RoundExpectation } from './harness';

/**
 * A Minesweeper position written as a picture.
 *
 *   '....2*'     .  hidden, no mine        _  open, nothing next to it
 *   '..f13*'     *  hidden mine            1-8 open, that many mines around
 *   '***...'     f  flag on a safe cell    X  an uncovered mine
 *                F  flag on a mine
 *
 * The picture carries both what the player sees and what is under the board,
 * which is what makes it a *state* rather than a screenshot. Writing a wrong
 * number fails the case: every position is rendered back and compared to what
 * was written before the action runs.
 *
 * A patch is placed on the real Expert board — 30x16 with 99 mines — and the
 * mines it does not account for are dropped in the far rows, never within reach
 * of the patch, so the numbers inside it stay true.
 */

export interface Patch {
  /** where the picture's top-left corner sits on the board */
  readonly at?: { col: number; row: number };
  readonly rows: readonly string[];
}

const BUFFER_ROWS = 1;

export function buildMinesweeper(difficulty: string, patch: Patch): MinesweeperState {
  const state = minesweeperSpec.create(createRng(1), difficulty);
  const origin = patch.at ?? { col: 0, row: 0 };
  const height = patch.rows.length;
  const width = Math.max(...patch.rows.map((r) => r.length));

  if (origin.col + width > state.cols || origin.row + height > state.rows) {
    throw new Error('the picture does not fit on the board');
  }

  const mines = new Set<number>();
  patch.rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const i = (origin.row + r) * state.cols + origin.col + c;
      if (ch === '*' || ch === 'F' || ch === 'X') mines.add(i);
      if (ch === 'f' || ch === 'F') state.flags[i] = true;
      if (ch === 'X' || ch === '_' || /[1-8]/.test(ch)) state.revealed[i] = true;
      else if (ch !== '.' && ch !== '*' && ch !== 'f' && ch !== 'F') {
        throw new Error(`not a board character: "${ch}"`);
      }
    });
  });

  // The rest of the 99 go in the far rows, out of reach of the picture, so the
  // board is a real Expert board and the stat and the solver see the truth.
  const safeFrom = (origin.row + height + BUFFER_ROWS) * state.cols;
  for (let i = state.cols * state.rows - 1; i >= safeFrom && mines.size < state.mineCount; i--) {
    mines.add(i);
  }
  if (mines.size !== state.mineCount) {
    throw new Error(`only ${mines.size} of ${state.mineCount} mines could be placed`);
  }

  state.mines = [...mines].sort((a, b) => a - b);
  state.started = true;
  return state;
}

export function renderMinesweeper(s: MinesweeperState, patch: Patch): string[] {
  const origin = patch.at ?? { col: 0, row: 0 };
  const board = { cols: s.cols, rows: s.rows, mines: new Set(s.mines) };
  const width = Math.max(...patch.rows.map((r) => r.length));

  return patch.rows.map((_, r) => {
    let line = '';
    for (let c = 0; c < width; c++) {
      const i = (origin.row + r) * s.cols + origin.col + c;
      const mine = board.mines.has(i);
      if (s.revealed[i]) {
        if (mine) line += 'X';
        else {
          const n = adjacentCount(board, i);
          line += n === 0 ? '_' : String(n);
        }
      } else if (s.flags[i]) line += mine ? 'F' : 'f';
      else line += mine ? '*' : '.';
    }
    return line;
  });
}

/** Everything outside the picture, as one string, for "nothing else moved". */
const outsideOf = (s: MinesweeperState, patch: Patch): string => {
  const origin = patch.at ?? { col: 0, row: 0 };
  const width = Math.max(...patch.rows.map((r) => r.length));
  const height = patch.rows.length;
  const out: string[] = [];
  for (let i = 0; i < s.cols * s.rows; i++) {
    const c = i % s.cols, r = Math.floor(i / s.cols);
    const inside = c >= origin.col && c < origin.col + width
      && r >= origin.row && r < origin.row + height;
    if (!inside) out.push(`${s.revealed[i] ? 'o' : '.'}${s.flags[i] ? 'f' : ''}`);
  }
  return out.join('');
};

/* ---- the runner --------------------------------------------------------- */

export interface MinesHarness extends Harness<MinesweeperState> {
  /** a plain tap, in picture coordinates */
  readonly click: (col: number, row: number) => void;
  /** right-click or long-press — the flag accelerator */
  readonly secondary: (col: number, row: number) => void;
  /** the toolbar mode switch, which is the path that needs no second button */
  readonly setMode: (mode: 'reveal' | 'flag') => void;
  readonly index: (col: number, row: number) => number;
  readonly picture: () => string[];
}

export interface MinesScenario extends RoundExpectation {
  readonly name: string;
  /** state A */
  readonly given: readonly string[];
  readonly when: (h: MinesHarness) => void;
  /** state B */
  readonly then: readonly string[];
  readonly at?: { col: number; row: number };
  /** a loss uncovers mines all over the board, so it may say so */
  readonly outside?: 'unchanged' | 'any';
}

export function minesHarness(difficulty: string, patch: Patch): MinesHarness {
  const def = createGridGame(minesweeperSpec);
  const base = createHarness(def, { difficulty, state: buildMinesweeper(difficulty, patch) });
  const origin = patch.at ?? { col: 0, row: 0 };
  const index = (col: number, row: number): number =>
    (origin.row + row) * base.state.cols + origin.col + col;

  return Object.assign(base, {
    index,
    click: (col: number, row: number) =>
      minesweeperSpec.onCell(base.state, index(col, row), base.session, false),
    secondary: (col: number, row: number) =>
      minesweeperSpec.onCell(base.state, index(col, row), base.session, true),
    setMode: (mode: 'reveal' | 'flag') => {
      const button = minesweeperSpec.toolbar?.(base.session, () => { /* redraw */ })
        .find((b) => b.id === mode);
      if (!button) throw new Error(`no toolbar button for "${mode}"`);
      button.onClick();
    },
    picture: () => renderMinesweeper(base.state, patch),
  });
}

export function runMinesScenarios(
  difficulty: string, scenarios: readonly MinesScenario[],
): void {
  for (const s of scenarios) {
    it(s.name, () => {
      const patch: Patch = { ...(s.at ? { at: s.at } : {}), rows: s.given };
      const h = minesHarness(difficulty, patch);
      expect(h.picture(), 'the position must read back as it was written').toEqual([...s.given]);

      const before = outsideOf(h.state, patch);
      h.clear();

      s.when(h);

      expect(h.picture()).toEqual([...s.then]);
      if ((s.outside ?? 'unchanged') === 'unchanged') {
        expect(outsideOf(h.state, patch), 'nothing outside the picture may change').toBe(before);
      }
      checkRound(h, s);
    });
  }
}
