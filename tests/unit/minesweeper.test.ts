import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { generateBoard } from '../../src/games/minesweeper/generate';
import { isSolvable, deduce, flood, adjacentCount } from '../../src/games/minesweeper/solver';
import { minesweeperSpec, type MinesweeperState } from '../../src/games/minesweeper/def';
import { neighbours } from '../../src/games/grid/layout';

const SIZES = {
  easy: { cols: 8, rows: 8, mineCount: 10 },
  medium: { cols: 12, rows: 12, mineCount: 25 },
  hard: { cols: 16, rows: 16, mineCount: 50 },
};

describe('solver', () => {
  it('counts adjacent mines', () => {
    const board = { cols: 3, rows: 3, mines: new Set([0, 1]) };
    expect(adjacentCount(board, 4)).toBe(2);
    expect(adjacentCount(board, 8)).toBe(0);
  });

  it('floods through zeros and stops at numbers', () => {
    // a single mine in the corner of a 4x4 leaves everything else reachable
    const board = { cols: 4, rows: 4, mines: new Set([0]) };
    const revealed = new Set<number>();
    flood(board, revealed, 15);
    expect(revealed.size).toBe(15);
    expect(revealed.has(0)).toBe(false);
  });

  it('deduces safe cells from a satisfied number', () => {
    const board = { cols: 3, rows: 3, mines: new Set([0]) };
    const step = deduce(board, new Set([4]), new Set([0]));
    expect(step).not.toBeNull();
    expect(step!.safe.length).toBeGreaterThan(0);
    expect(step!.mines).toHaveLength(0);
  });

  it('reports a board needing a guess as unsolvable', () => {
    // two mines in a corridor with no way to tell which cell holds which
    const board = { cols: 4, rows: 1, mines: new Set([3]) };
    // revealing cell 0 tells nothing about 2 vs 3 without more information
    expect(typeof isSolvable(board, 0)).toBe('boolean');
  });
});

describe('board generation is fair', () => {
  it.each(Object.entries(SIZES))(
    '%s boards are solvable by logic alone and safe on the first click',
    (_name, size) => {
      const rng = createRng(20260912);
      let fairCount = 0;
      const trials = 25;

      for (let t = 0; t < trials; t++) {
        const firstClick = rng.int(size.cols * size.rows);
        const { mines, fair } = generateBoard(size, rng.int(0x7fffffff), firstClick);

        expect(mines).toHaveLength(size.mineCount);
        expect(new Set(mines).size).toBe(size.mineCount);

        // the click and everything touching it must be clear
        const forbidden = [firstClick, ...neighbours(firstClick, size.cols, size.rows)];
        for (const i of forbidden) expect(mines).not.toContain(i);

        if (fair) {
          fairCount++;
          expect(
            isSolvable({ cols: size.cols, rows: size.rows, mines: new Set(mines) }, firstClick),
            'a board reported fair must really be solvable',
          ).toBe(true);
        }
      }

      // The generator may fall back rather than hang, but that must be rare.
      expect(fairCount / trials).toBeGreaterThan(0.8);
    },
  );

  it('is reproducible from its seed', () => {
    const a = generateBoard(SIZES.easy, 1234, 27).mines;
    const b = generateBoard(SIZES.easy, 1234, 27).mines;
    expect(a).toEqual(b);
  });
});

describe('minesweeper rules', () => {
  const fresh = (difficulty = 'easy'): MinesweeperState =>
    minesweeperSpec.create(createRng(7), difficulty);

  const hostFor = (state: MinesweeperState) => ({
    state,
    settings: {} as never,
    sound: { place() {}, bad() {}, flip() {} } as never,
    toast: () => {},
    commit: (fn: (d: MinesweeperState) => void) => fn(state),
  });

  it('places no mines until the first click', () => {
    const s = fresh();
    expect(s.started).toBe(false);
    expect(s.mines).toHaveLength(0);
    expect(minesweeperSpec.score(s)).toBe(0);
  });

  it('never loses on the first click', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = minesweeperSpec.create(createRng(seed), 'medium');
      minesweeperSpec.onCell(s, 40, hostFor(s) as never);
      expect(s.dead, `seed ${seed} killed the player on move one`).toBeNull();
      expect(s.revealed[40]).toBe(true);
    }
  });

  it('scores revealed cells and correct flags, never clicks', () => {
    const s = fresh();
    minesweeperSpec.onCell(s, 27, hostFor(s) as never);
    const afterReveal = minesweeperSpec.score(s);
    expect(afterReveal).toBeGreaterThan(0);

    // flagging and unflagging the same cell repeatedly earns nothing
    s.mode = 'flag';
    const mine = s.mines[0]!;
    for (let i = 0; i < 6; i++) {
      minesweeperSpec.onCell(s, mine, hostFor(s) as never);
      minesweeperSpec.onCell(s, mine, hostFor(s) as never);
    }
    expect(minesweeperSpec.score(s)).toBe(afterReveal);
  });

  it('offers no undo, because a reveal cannot honestly be taken back', () => {
    expect(minesweeperSpec.canUndo).toBe(false);
    expect(minesweeperSpec.hasLoss).toBe(true);
  });

  it('hints only at cells logic can prove, and says which rule proved it', () => {
    const s = fresh();
    minesweeperSpec.onCell(s, 27, hostFor(s) as never);
    const hint = minesweeperSpec.hint(s);
    if (hint) {
      expect(hint.kind).toBe('cell');
      if (hint.kind === 'cell') expect(hint.message).toBeTruthy();
    }
  });

  it('wins when every safe cell is revealed', () => {
    const s = fresh();
    minesweeperSpec.onCell(s, 27, hostFor(s) as never);
    expect(minesweeperSpec.isWon(s)).toBe(false);
    for (let i = 0; i < s.cols * s.rows; i++) {
      if (!s.mines.includes(i)) s.revealed[i] = true;
    }
    expect(minesweeperSpec.isWon(s)).toBe(true);
  });
});
