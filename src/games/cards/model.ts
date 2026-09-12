import type { Difficulty, GameDef, GameId, Hint, Par, Rng, ViewHost } from '../../core/types';
import type { Card, PileId, Piles } from './deck';
import { createCardView } from './view';

export interface CardState {
  piles: Piles;
  /** face-down cards at deal; the baseline for "cards revealed" scoring */
  hidden0: number;
}

/** Where each pile sits: top row slots by column, plus the tableau columns. */
export interface CardLayoutSpec {
  readonly columns: number;
  readonly top: ReadonlyArray<{ pile: PileId; col: number }>;
  readonly tableau: readonly PileId[];
  /** piles drawn stacked (foundations, free cells, stock) rather than fanned */
  readonly stacked: readonly PileId[];
}

/**
 * What a card game has to say for itself. Everything else — score plumbing,
 * streak, undo, autosave, timer, overlays, art, input, animation — is shared.
 */
export interface CardSpec {
  readonly id: GameId;
  readonly name: string;
  readonly emoji: string;
  readonly blurb: string;
  readonly difficulties?: readonly Difficulty[];

  deal(rng: Rng, difficulty?: string): CardState;
  layoutOf(state: CardState): CardLayoutSpec;

  canGrab(state: CardState, pile: PileId, index: number): boolean;
  canDrop(state: CardState, run: readonly Card[], dest: PileId, from: PileId): boolean;
  /** Hebrew reason a drop was refused; '' when there is nothing worth saying. */
  whyNot(state: CardState, run: readonly Card[], dest: PileId): string;

  /** Klondike's draw and Spider's deal. Returns false when it refused. */
  onStock?(state: CardState, host: ViewHost<CardState>): boolean;
  /** Runs after every move — Spider uses it to retire a completed set. */
  afterMove?(state: CardState, host: ViewHost<CardState>): void;

  score(state: CardState): number;
  isWon(state: CardState): boolean;
  hint(state: CardState): Hint | null;
  par(difficulty?: string): Par;

  stat?(state: CardState): { label: string; value: string } | null;
}

/** Wraps a card game's rules into the GameDef the engine consumes. */
export function createCardGame(spec: CardSpec): GameDef<CardState> {
  return {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    blurb: spec.blurb,
    ...(spec.difficulties ? { difficulties: spec.difficulties } : {}),
    canUndo: true,
    hasLoss: false,

    create: (rng, difficulty) => spec.deal(rng, difficulty),
    score: (state) => spec.score(state),
    isWon: (state) => spec.isWon(state),
    hint: (state) => spec.hint(state),
    par: (difficulty) => spec.par(difficulty),

    createView: (host) => createCardView(host, spec),
  };
}

/* ---- helpers the game rules share --------------------------------------- */

/** cards still face-down in the tableau */
export function hiddenCount(state: CardState, tableau: readonly PileId[]): number {
  let n = 0;
  for (const p of tableau) for (const c of state.piles[p] ?? []) if (!c.up) n++;
  return n;
}

/** Turn the top card of a pile face up, as every tableau does after a move. */
export function revealTop(piles: Piles, pile: PileId): boolean {
  const a = piles[pile];
  const t = a && a.length > 0 ? a[a.length - 1] : undefined;
  if (t && !t.up) { t.up = true; return true; }
  return false;
}
