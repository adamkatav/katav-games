/** Shared contracts. A game describes itself; the engine decides everything else. */

export type GameId = 'klondike' | 'spider' | 'freecell' | 'minesweeper' | 'sudoku' | 'g2048';

export interface Difficulty {
  readonly id: string;
  readonly label: string;      // Hebrew
  readonly note?: string;      // e.g. "מומלץ להתחלה"
}

export interface Par {
  readonly moves: number;
  readonly time: number;       // seconds
}

/** A suggested move. `kind` lets a view highlight the right things. */
export type Hint =
  | { kind: 'move'; from: string; index: number; to: string }
  | { kind: 'pile'; pile: string; message?: string }
  | { kind: 'cell'; index: number; message?: string };

export interface Rng {
  /** float in [0,1) */
  next(): number;
  int(maxExclusive: number): number;
  shuffle<T>(items: T[]): T[];
}

/** What a view may do. Views never touch state, score, undo or saves directly. */
export interface ViewHost<S> {
  readonly state: S;
  /**
   * The only way to change the board. One call snapshots for undo, applies the
   * mutation, recomputes the derived score, advances or breaks the streak,
   * counts the move, autosaves, re-renders, and checks win then loss.
   */
  commit(mutate: (draft: S) => void, opts?: CommitOptions): void;
  toast(message: string): void;
  readonly sound: SoundLike;
  readonly settings: SettingsLike;
}

export interface CommitOptions {
  /** default true; false for changes that should not be undoable */
  undoable?: boolean;
  /** default false; true suppresses the move counter (e.g. a pure UI toggle) */
  free?: boolean;
}

export interface GameView<S> {
  mount(root: HTMLElement): void;
  render(state: S): void;
  /** viewport changed */
  layout(): void;
  destroy(): void;
  /** optional extra toolbar buttons, e.g. a reveal/flag mode switch */
  toolbar?(): readonly ToolbarButton[];
  /** optional game-specific stat, e.g. "סדרות 3/8" */
  stat?(state: S): { label: string; value: string } | null;
  /** highlight a hint on the board */
  showHint?(hint: Hint): void;
}

export interface ToolbarButton {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly tone?: 'green' | 'red' | 'ghost';
  onClick(): void;
  /** Lit when true — used by mode switches such as reveal/flag. The shell
   *  re-reads this after every toolbar click, so a toggle shows immediately. */
  isActive?(): boolean;
}

export interface GameDef<S> {
  readonly id: GameId;
  readonly name: string;       // Hebrew
  readonly emoji: string;
  readonly blurb: string;      // Hebrew one-liner for the home card
  readonly difficulties?: readonly Difficulty[];
  /** false where undo would have to lie — a revealed Minesweeper cell */
  readonly canUndo: boolean;
  readonly hasLoss: boolean;

  create(rng: Rng, difficulty?: string): S;
  /** PURE and derived from the board. There is no score field to accumulate into. */
  score(state: S): number;
  isWon(state: S): boolean;
  isLost?(state: S): boolean;
  hint(state: S): Hint | null;
  par(difficulty?: string): Par;
  /**
   * Let the round carry on after it has been won, where that means something:
   * 2048 past its 2048 tile. Mutates the state so `isWon` stops being true.
   * Games without a "keep going" simply leave it out.
   */
  continueAfterWin?(state: S): void;

  createView(host: ViewHost<S>): GameView<S>;
}

/* Structural types, so core doesn't depend on the ui layer. */
export interface SoundLike {
  place(): void; flip(): void; found(): void; set(): void; bad(): void;
  deal(i: number): void; combo(level: number): void; comboEnd(): void;
  space(): void; win(): void; star(i: number): void; select(): void;
}

export interface SettingsLike {
  marks: boolean;
  size: number;
  rtl: boolean;
  sound: boolean;
}
