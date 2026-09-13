import { expect } from 'vitest';
import { Session, type Outcome, type RoundSummary, type SavedRound } from '../../../src/core/engine';
import type { GameDef, Hint, SettingsLike, SoundLike } from '../../../src/core/types';

/**
 * A session driven without a browser.
 *
 * Every scripted scenario runs through the real `Session`, so undo, the derived
 * score, the streak, the move counter, autosave and the win/loss decision are
 * the shipped ones rather than a test's idea of them. What the harness replaces
 * is only the world outside: sound, toasts and storage, each recorded so a
 * scenario can assert the feedback as well as the board.
 */

const SOUND_KEYS = [
  'place', 'flip', 'found', 'set', 'bad', 'deal', 'combo', 'comboEnd',
  'space', 'win', 'star', 'select',
] as const;

export interface Harness<S> {
  readonly session: Session<S>;
  readonly state: S;
  readonly score: number;
  readonly streak: number;
  readonly moves: number;
  readonly outcome: Outcome;
  readonly canUndo: boolean;
  /** every toast raised since the last `clear()`, oldest first */
  readonly toasts: readonly string[];
  /** every sound played since the last `clear()`, oldest first */
  readonly sounds: readonly string[];
  readonly saved: SavedRound | null;
  readonly summary: RoundSummary | null;
  /** the personal best recorded for this game and difficulty */
  readonly best: number;

  undo(): boolean;
  /** the hint button: asks for help, which costs the streak */
  hint(): Hint | null;
  clear(): void;
}

export interface HarnessOptions<S> {
  readonly difficulty?: string;
  readonly seed?: number;
  /** a hand-built position to start from, instead of dealing one */
  readonly state?: S;
}

export function createHarness<S>(def: GameDef<S>, options: HarnessOptions<S> = {}): Harness<S> {
  const toasts: string[] = [];
  const sounds: string[] = [];
  const bests = new Map<string, number>();
  let saved: SavedRound | null = null;
  let summary: RoundSummary | null = null;

  const sound = Object.fromEntries(
    SOUND_KEYS.map((key) => [key, () => { sounds.push(key); }]),
  ) as unknown as SoundLike;

  const settings: SettingsLike = { marks: false, size: 1, rtl: true, sound: false };

  // A game that starts from a hand-built position still goes through the engine
  // in full: only the deal is replaced.
  const wrapped: GameDef<S> = options.state !== undefined
    ? { ...def, create: () => options.state as S }
    : def;

  const session = new Session<S>(
    wrapped,
    {
      sound,
      settings,
      toast: (message) => { toasts.push(message); },
      readBest: (key) => bests.get(key) ?? 0,
      writeBest: (key, value) => { bests.set(key, value); },
      save: (round) => { saved = round; },
      events: {
        onRender: () => { /* the board is the view's business */ },
        onScore: () => { /* asserted through `score` and `streak` */ },
        onOutcome: (_outcome, round) => { summary = round; },
      },
    },
    {
      ...(options.difficulty !== undefined ? { difficulty: options.difficulty } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
    },
  );

  return {
    session,
    get state(): S { return session.state; },
    get score(): number { return session.score.total; },
    get streak(): number { return session.score.streak; },
    get moves(): number { return session.moves; },
    get outcome(): Outcome { return session.outcome; },
    get canUndo(): boolean { return session.canUndo; },
    get toasts(): readonly string[] { return toasts; },
    get sounds(): readonly string[] { return sounds; },
    get saved(): SavedRound | null { return saved; },
    get summary(): RoundSummary | null { return summary; },
    get best(): number { return bests.get(session.bestKey) ?? 0; },

    undo: () => session.undo(),
    hint: () => session.penaliseForHint(),
    clear() { toasts.length = 0; sounds.length = 0; },
  };
}

/** What a scenario asserts about the round, alongside the board itself. */
export interface RoundExpectation {
  readonly score?: number;
  readonly moves?: number;
  readonly streak?: number;
  readonly outcome?: Outcome;
  readonly canUndo?: boolean;
  /** the last sound played by the action */
  readonly sound?: (typeof SOUND_KEYS)[number];
  /** sounds the action must have played, in this order, among others */
  readonly soundsInclude?: readonly (typeof SOUND_KEYS)[number][];
  /** a toast the action must have raised; null means it must have raised none */
  readonly toast?: RegExp | null;
}

/** Assert the non-board half of a scenario's expected state B. */
export function checkRound<S>(h: Harness<S>, expected: RoundExpectation): void {
  if (expected.score !== undefined) expect(h.score, 'score').toBe(expected.score);
  if (expected.moves !== undefined) expect(h.moves, 'moves').toBe(expected.moves);
  if (expected.streak !== undefined) expect(h.streak, 'streak').toBe(expected.streak);
  if (expected.outcome !== undefined) expect(h.outcome, 'outcome').toBe(expected.outcome);
  if (expected.canUndo !== undefined) expect(h.canUndo, 'canUndo').toBe(expected.canUndo);
  if (expected.sound !== undefined) {
    expect(h.sounds[h.sounds.length - 1], 'last sound').toBe(expected.sound);
  }
  if (expected.soundsInclude !== undefined) {
    let at = -1;
    for (const key of expected.soundsInclude) {
      at = h.sounds.indexOf(key, at + 1);
      expect(at, `sound "${key}" in ${h.sounds.join(',')}`).toBeGreaterThanOrEqual(0);
    }
  }
  if (expected.toast === null) expect(h.toasts, 'toasts').toEqual([]);
  else if (expected.toast !== undefined) {
    expect(h.toasts.join(' | '), 'toast').toMatch(expected.toast);
  }
}
