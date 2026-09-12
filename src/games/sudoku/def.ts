import type { Difficulty, Hint, Rng, ToolbarButton, ViewHost } from '../../core/types';
import { createGridGame, type CellView, type GridSpec } from '../grid/model';
import { generatePuzzle } from './generate';
import { CELLS, SIZE, conflicts, nextStep, type Grid } from './solver';

export interface SudokuState {
  /** the givens; 0 where the player must fill in */
  puzzle: Grid;
  /** the player's digits, 0 where empty */
  entries: Grid;
  /** pencil marks as a bitmask per cell, bit 0 = digit 1 */
  pencil: number[];
  solution: Grid;
  selected: number | null;
  pad: number;                  // the digit the pad currently holds
  mode: 'write' | 'note';
}

const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', label: 'קל', note: 'מומלץ להתחלה' },
  { id: 'medium', label: 'בינוני' },
  { id: 'hard', label: 'קשה' },
];

const TECHNIQUE_TEXT: Record<string, string> = {
  'naked-single': 'בתא הזה נשארה רק אפשרות אחת',
  'hidden-single': 'זה המקום היחיד בשורה, בטור או בריבוע שהספרה הזאת יכולה להיכנס בו',
};

export const sudokuSpec: GridSpec<SudokuState> = {
  id: 'sudoku',
  name: 'סודוקו',
  emoji: '🔢',
  blurb: 'למלא ספרות 1 עד 9 — בלי חזרות',
  difficulties: DIFFICULTIES,
  canUndo: true,
  hasLoss: false,          // Sudoku has no losing condition; do not invent one
  minCell: 32,

  create(rng: Rng, difficulty = 'easy'): SudokuState {
    const { puzzle, solution } = generatePuzzle(rng, difficulty);
    return {
      puzzle,
      entries: new Array<number>(CELLS).fill(0),
      pencil: new Array<number>(CELLS).fill(0),
      solution,
      selected: null,
      pad: 1,
      mode: 'write',
    };
  },

  dims: () => ({ cols: SIZE, rows: SIZE }),

  cell(s, i): CellView {
    const given = s.puzzle[i] !== 0;
    const value = given ? s.puzzle[i]! : s.entries[i]!;
    const bad = conflicts(merged(s)).has(i);

    const classes = ['sud'];
    if (given) classes.push('given');
    if (i === s.selected) classes.push('sel');
    if (bad && !given) classes.push('bad');
    if (boxShade(i)) classes.push('shade');

    if (value !== 0) return { text: String(value), cls: classes.join(' ') };

    const marks = s.pencil[i]!;
    if (marks !== 0) {
      const digits: string[] = [];
      for (let d = 1; d <= SIZE; d++) if (marks & (1 << (d - 1))) digits.push(String(d));
      classes.push('notes');
      return { text: digits.join(' '), cls: classes.join(' '), scale: 0.34 };
    }
    return { cls: classes.join(' ') };
  },

  onCell(s, i, host: ViewHost<SudokuState>) {
    if (s.puzzle[i] !== 0) {                   // givens are locked
      host.commit((d) => { d.selected = i; }, { undoable: false, free: true });
      host.sound.bad();
      return;
    }
    host.commit((d) => { d.selected = i; }, { undoable: false, free: true });
    host.sound.select();
  },

  score(s) {
    // Derived from the board: re-typing a digit earns nothing.
    let correct = 0;
    for (let i = 0; i < CELLS; i++) {
      if (s.puzzle[i] === 0 && s.entries[i] !== 0 && s.entries[i] === s.solution[i]) correct++;
    }
    return correct * 12;
  },

  isWon: (s) => {
    for (let i = 0; i < CELLS; i++) {
      const v = s.puzzle[i] !== 0 ? s.puzzle[i] : s.entries[i];
      if (v !== s.solution[i]) return false;
    }
    return true;
  },

  hint(s): Hint | null {
    const step = nextStep(merged(s));
    if (!step) return null;
    return {
      kind: 'cell',
      index: step.index,
      message: `${step.value} — ${TECHNIQUE_TEXT[step.technique] ?? ''}`,
    };
  },

  stat: (s) => {
    let left = 0;
    for (let i = 0; i < CELLS; i++) if (s.puzzle[i] === 0 && s.entries[i] === 0) left++;
    return { label: 'נותרו', value: String(left) };
  },

  toolbar(host, refresh): readonly ToolbarButton[] {
    const set = (mode: SudokuState['mode']) => () => {
      host.commit((d) => { d.mode = mode; }, { undoable: false, free: true });
      refresh();
    };
    return [
      { id: 'write', label: 'ספרה', icon: '✏️', onClick: set('write'),
        isActive: () => host.state.mode === 'write' },
      { id: 'note', label: 'טיוטה', icon: '📝', onClick: set('note'),
        isActive: () => host.state.mode === 'note' },
    ];
  },

  /** The number pad. Tapping a cell then a digit — never a keyboard. */
  controls(host, refresh): HTMLElement {
    const pad = document.createElement('div');
    pad.className = 'pad sudoku-pad';

    for (let d = 1; d <= SIZE; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(d);
      b.addEventListener('click', () => { place(host, d); refresh(); });
      pad.append(b);
    }

    const erase = document.createElement('button');
    erase.type = 'button';
    erase.textContent = '⌫';
    erase.addEventListener('click', () => { place(host, 0); refresh(); });
    pad.append(erase);

    return pad;
  },

  par: (difficulty = 'easy') =>
    difficulty === 'hard' ? { moves: 70, time: 900 }
    : difficulty === 'medium' ? { moves: 60, time: 600 }
    : { moves: 55, time: 360 },
};

/** Givens and entries as one grid, for conflict checking and hints. */
function merged(s: SudokuState): Grid {
  const out = s.puzzle.slice();
  for (let i = 0; i < CELLS; i++) if (out[i] === 0) out[i] = s.entries[i]!;
  return out;
}

const boxShade = (i: number): boolean => {
  const band = Math.floor(Math.floor(i / SIZE) / 3);
  const stack = Math.floor((i % SIZE) / 3);
  return (band + stack) % 2 === 1;
};

function place(host: ViewHost<SudokuState>, digit: number): void {
  const s = host.state;
  const i = s.selected;
  if (i === null) { host.toast('קודם בוחרים תא'); host.sound.bad(); return; }
  if (s.puzzle[i] !== 0) { host.sound.bad(); return; }

  host.commit((d) => {
    if (digit === 0) { d.entries[i] = 0; d.pencil[i] = 0; return; }
    if (d.mode === 'note') {
      d.pencil[i] = (d.pencil[i] ?? 0) ^ (1 << (digit - 1));  // toggling is its own undo
      return;
    }
    d.entries[i] = d.entries[i] === digit ? 0 : digit;
    d.pencil[i] = 0;
  });
  host.sound.place();
}

export const sudoku = createGridGame(sudokuSpec);
