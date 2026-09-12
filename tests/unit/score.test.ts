import { describe, expect, it } from 'vitest';
import { applyScore, breakStreak, comboMult, newScoreState, stars } from '../../src/core/score';
import { createRng } from '../../src/core/rng';
import { klondikeSpec } from '../../src/games/cards/klondike';
import { spiderSpec } from '../../src/games/cards/spider';
import type { CardState } from '../../src/games/cards/model';

/**
 * The properties here are the two exploits that shipped, stated as invariants:
 * a board that returns to a position must return the same score, and a streak
 * bonus must never be payable twice for the same progress.
 */

const play = (base: number, state = newScoreState(0)) => applyScore(state, base);

describe('derived scoring', () => {
  it('returns the same score for the same position, however you got there', () => {
    let s = newScoreState(0);
    const seen = new Set<number>();
    for (let i = 0; i < 8; i++) {
      s = play(15, s).state;   // card up to a foundation
      seen.add(s.total);
      s = play(0, s).state;    // and back down again
      seen.add(s.total);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 15]);
  });

  it('never banks a bonus for progress already made', () => {
    let s = newScoreState(0);
    for (let i = 0; i < 10; i++) {
      s = play(5, s).state;
      s = play(0, s).state;
    }
    expect(s.bonus).toBe(0);
  });

  it('builds a streak on real progress', () => {
    let s = newScoreState(0);
    const streaks: number[] = [];
    for (const base of [15, 30, 45, 60]) { s = play(base, s).state; streaks.push(s.streak); }
    expect(streaks).toEqual([1, 2, 3, 4]);
    expect(s.bonus).toBeGreaterThan(0);
  });

  it('survives a neutral setup move but breaks on a regression', () => {
    let s = newScoreState(0);
    s = play(15, s).state;
    s = play(30, s).state;
    expect(s.streak).toBe(2);

    const neutral = play(30, s);
    expect(neutral.state.streak).toBe(2);
    expect(neutral.event).toBe('unchanged');

    const regress = play(15, neutral.state);
    expect(regress.state.streak).toBe(0);
    expect(regress.event).toBe('broken');
  });

  it('costs the streak when a hint is used', () => {
    let s = newScoreState(0);
    s = play(15, s).state;
    s = play(30, s).state;
    expect(breakStreak(s).state.streak).toBe(0);
    expect(breakStreak(newScoreState(0)).event).toBe('unchanged');
  });

  it('caps the multiplier', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(2)).toBe(1.5);
    expect(comboMult(6)).toBe(4);
    expect(comboMult(99)).toBe(4);
  });

  it('rates generously but not uniformly', () => {
    const par = { moves: 100, time: 300 };
    expect(stars(par, 60, 120)).toBe(5);
    expect(stars(par, 400, 2000)).toBe(1);
  });
});

describe('board scores are pure functions of the board', () => {
  const rng = () => createRng(7);

  it.each([
    ['klondike', klondikeSpec],
    ['spider', spiderSpec],
  ])('%s scores identically for identical boards', (_name, spec) => {
    const a = spec.deal(rng(), '1');
    const b = spec.deal(rng(), '1');
    expect(spec.score(a)).toBe(spec.score(b));
  });

  it('klondike scores a revealed card and a foundation card', () => {
    const state: CardState = klondikeSpec.deal(rng());
    const before = klondikeSpec.score(state);
    const ace = Object.values(state.piles).flat().find((c) => c.rank === 1)!;
    state.piles['f0'] = [ace];
    expect(klondikeSpec.score(state)).toBe(before + 15);
  });
});
