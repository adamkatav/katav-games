import type { Difficulty, Hint, Rng, ToolbarButton, ViewHost } from '../../core/types';
import { createGridGame, type CellView, type GridSpec } from '../grid/model';
import { generateBoard } from './generate';
import { adjacentCount, deduce, flood } from './solver';

/**
 * State is deliberately plain arrays and numbers. The engine snapshots undo and
 * autosave with JSON.stringify, and a Set would serialise to {} — silently
 * losing the board on resume.
 */
export interface MinesweeperState {
  cols: number;
  rows: number;
  mineCount: number;
  /** generation happens on the first click, but stays reproducible from here */
  seed: number;
  started: boolean;
  mines: number[];
  revealed: boolean[];
  flags: boolean[];
  /** the mine that ended the round, so the loss can be shown, not just stated */
  dead: number | null;
  mode: 'reveal' | 'flag';
}

const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', label: 'קל · 8×8', note: 'מומלץ להתחלה' },
  { id: 'medium', label: 'בינוני · 12×12' },
  { id: 'hard', label: 'קשה · 16×16' },
];

// Square boards throughout: the classic 30x16 expert board needs a wide screen,
// and this has to work on a phone.
const SIZES: Record<string, { cols: number; rows: number; mineCount: number }> = {
  easy: { cols: 8, rows: 8, mineCount: 10 },
  medium: { cols: 12, rows: 12, mineCount: 25 },
  hard: { cols: 16, rows: 16, mineCount: 50 },
};

const boardOf = (s: MinesweeperState) =>
  ({ cols: s.cols, rows: s.rows, mines: new Set(s.mines) });

const isMine = (s: MinesweeperState, i: number): boolean => s.mines.includes(i);

const setsOf = (s: MinesweeperState) => {
  const revealed = new Set<number>();
  const flagged = new Set<number>();
  for (let i = 0; i < s.revealed.length; i++) {
    if (s.revealed[i]) revealed.add(i);
    if (s.flags[i]) flagged.add(i);
  }
  return { revealed, flagged };
};

const RULE_TEXT: Record<string, string> = {
  count: 'המספר הזה כבר יודע איפה כל המוקשים שלו',
  subset: 'ההשוואה בין שני המספרים האלה מגלה את התא הזה',
  total: 'לפי מספר המוקשים שנשארו',
};

export const minesweeperSpec: GridSpec<MinesweeperState> = {
  id: 'minesweeper',
  name: 'מוקשים',
  emoji: '💣',
  blurb: 'לגלות את כל התאים הבטוחים — בלי ניחושים',
  difficulties: DIFFICULTIES,
  canUndo: false,     // a revealed cell cannot be un-revealed without removing the game
  hasLoss: true,
  minCell: 30,

  create(rng: Rng, difficulty = 'easy'): MinesweeperState {
    const size = SIZES[difficulty] ?? SIZES['easy']!;
    const total = size.cols * size.rows;
    return {
      ...size,
      seed: rng.int(0x7fffffff),
      started: false,
      mines: [],
      revealed: new Array<boolean>(total).fill(false),
      flags: new Array<boolean>(total).fill(false),
      dead: null,
      mode: 'reveal',
    };
  },

  dims: (s) => ({ cols: s.cols, rows: s.rows }),

  cell(s, i): CellView {
    const dead = s.dead !== null;

    if (!s.revealed[i]) {
      if (dead && isMine(s, i)) {
        return { text: '💣', cls: s.flags[i] ? 'open mine found' : 'open mine' };
      }
      if (s.flags[i]) return { text: dead ? '✗' : '🚩', cls: dead ? 'hidden wrong' : 'hidden flag' };
      return { cls: 'hidden' };
    }

    if (isMine(s, i)) return { text: '💥', cls: 'open mine blast' };
    const n = adjacentCount(boardOf(s), i);
    return n === 0 ? { cls: 'open' } : { text: String(n), cls: `open n${n}` };
  },

  onCell(s, i, host: ViewHost<MinesweeperState>) {
    if (s.dead !== null) return;

    if (s.mode === 'flag') {
      // Flags are self-reversing, which is why this game needs no undo button.
      host.commit((d) => { d.flags[i] = !d.flags[i]; });
      host.sound.flip();
      return;
    }

    if (s.flags[i]) { host.toast('התא מסומן בדגל — צריך להוריד אותו קודם'); host.sound.bad(); return; }
    if (s.revealed[i]) return;

    host.commit((d) => {
      if (!d.started) {
        const { mines, fair } = generateBoard(
          { cols: d.cols, rows: d.rows, mineCount: d.mineCount }, d.seed, i,
        );
        d.mines = mines;
        d.started = true;
        if (!fair) host.toast('הלוח הזה עלול לדרוש ניחוש');
      }

      if (d.mines.includes(i)) {
        d.dead = i;
        d.revealed[i] = true;
        for (const m of d.mines) d.revealed[m] = true;   // show what happened
        return;
      }

      const revealed = new Set<number>();
      for (let k = 0; k < d.revealed.length; k++) if (d.revealed[k]) revealed.add(k);
      flood({ cols: d.cols, rows: d.rows, mines: new Set(d.mines) }, revealed, i);
      for (const k of revealed) d.revealed[k] = true;
    });

    host.sound[s.dead === null ? 'place' : 'bad']();
  },

  score(s) {
    if (!s.started) return 0;
    let safe = 0;
    for (let i = 0; i < s.revealed.length; i++) {
      if (s.revealed[i] && !isMine(s, i)) safe++;
    }
    const correctFlags = s.mines.filter((m) => s.flags[m]).length;
    return safe * 10 + correctFlags * 15;
  },

  isWon(s) {
    if (!s.started || s.dead !== null) return false;
    const total = s.cols * s.rows;
    let revealed = 0;
    for (let i = 0; i < total; i++) if (s.revealed[i] && !isMine(s, i)) revealed++;
    return revealed === total - s.mines.length;
  },

  isLost: (s) => s.dead !== null,

  hint(s): Hint | null {
    if (!s.started || s.dead !== null) return null;
    const { revealed, flagged } = setsOf(s);
    const step = deduce(boardOf(s), revealed, flagged);
    if (!step) return null;

    // Naming the rule turns the hint into a lesson rather than a rescue.
    const message = RULE_TEXT[step.rule] ?? '';
    const target = step.safe[0] ?? step.mines[0];
    if (target === undefined) return null;
    return {
      kind: 'cell',
      index: target,
      message: step.safe.length > 0 ? `תא בטוח — ${message}` : `כאן יש מוקש — ${message}`,
    };
  },

  stat: (s) => ({
    label: 'מוקשים',
    value: `${s.mines.length > 0 ? s.mines.length - s.flags.filter(Boolean).length : s.mineCount}`,
  }),

  toolbar(host, refresh): readonly ToolbarButton[] {
    const set = (mode: MinesweeperState['mode']) => () => {
      host.commit((d) => { d.mode = mode; }, { undoable: false, free: true });
      refresh();
    };
    return [
      { id: 'reveal', label: 'חשיפה', icon: '⛏️', onClick: set('reveal'),
        isActive: () => host.state.mode === 'reveal' },
      { id: 'flag', label: 'דגל', icon: '🚩', onClick: set('flag'),
        isActive: () => host.state.mode === 'flag' },
    ];
  },

  par: (difficulty = 'easy') =>
    difficulty === 'hard' ? { moves: 120, time: 420 }
    : difficulty === 'medium' ? { moves: 70, time: 240 }
    : { moves: 35, time: 110 },
};

export const minesweeper = createGridGame(minesweeperSpec);
