/**
 * Scoring and streak rules, shared by every game.
 *
 * Two invariants, both learned the hard way:
 *
 * 1. The base score is a pure function of the board (`GameDef.score`). Any move
 *    sequence that returns to the same position returns the same score, so
 *    shuffling a card back and forth cannot farm points.
 *
 * 2. The streak bonus is paid only on progress beyond the best position reached
 *    so far (`peak`) — never on a per-move delta. Without that, a multiplier
 *    would just re-open the same exploit one level up.
 */

export const COMBO_MULT = [1, 1, 1.5, 2, 2.5, 3, 4] as const;

export const comboMult = (streak: number): number =>
  COMBO_MULT[Math.min(Math.max(streak, 0), COMBO_MULT.length - 1)]!;

export interface ScoreState {
  /** base + bonus; what the player sees */
  total: number;
  /** banked streak bonus */
  bonus: number;
  /** best base score reached this round */
  peak: number;
  /** current streak length */
  streak: number;
}

export const newScoreState = (base = 0): ScoreState => ({
  total: base,
  bonus: 0,
  peak: base,
  streak: 0,
});

export type StreakEvent = 'advanced' | 'broken' | 'unchanged';

export interface ScoreUpdate {
  readonly state: ScoreState;
  readonly delta: number;
  readonly event: StreakEvent;
}

/** Fold a newly computed base score into the score state. */
export function applyScore(prev: ScoreState, base: number): ScoreUpdate {
  const prevBase = prev.total - prev.bonus;
  const gain = Math.max(0, base - prev.peak);

  const next: ScoreState = {
    total: 0,
    bonus: prev.bonus,
    peak: Math.max(prev.peak, base),
    streak: prev.streak,
  };

  let event: StreakEvent = 'unchanged';

  if (gain > 0) {
    next.streak = prev.streak + 1;
    const mult = comboMult(next.streak);
    if (mult > 1) next.bonus += Math.round(gain * (mult - 1));
    event = 'advanced';
  } else if (base < prevBase) {
    // Only a move that undoes progress breaks the streak. Setup moves that
    // score nothing are most of good play and must not be punished.
    if (prev.streak > 0) event = 'broken';
    next.streak = 0;
  }

  next.total = base + next.bonus;
  return { state: next, delta: next.total - prev.total, event };
}

/** Asking for help costs the streak, but only when help was actually given. */
export function breakStreak(prev: ScoreState): ScoreUpdate {
  if (prev.streak === 0) return { state: prev, delta: 0, event: 'unchanged' };
  return {
    state: { ...prev, streak: 0 },
    delta: 0,
    event: 'broken',
  };
}

/** End-of-round bonus for finishing under par. */
export function winBonus(par: { moves: number; time: number }, moves: number, seconds: number): number {
  return (
    Math.max(0, Math.round(par.time * 2 - seconds * 2)) +
    Math.max(0, (par.moves - moves) * 3)
  );
}

/** One to five stars, blended from moves and time against par. Deliberately generous. */
export function stars(par: { moves: number; time: number }, moves: number, seconds: number): number {
  const q =
    0.6 * Math.min(1.7, par.moves / Math.max(1, moves)) +
    0.4 * Math.min(1.7, par.time / Math.max(20, seconds));
  if (q >= 1.15) return 5;
  if (q >= 0.92) return 4;
  if (q >= 0.72) return 3;
  if (q >= 0.55) return 2;
  return 1;
}
