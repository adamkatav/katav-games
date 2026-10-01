import { describe, expect, it } from 'vitest';
import { applyScore, newScoreState, restartScore } from '../../src/core/score';
import { klondike, klondikeSpec } from '../../src/games/cards/klondike';
import { cardPosition, computeGeometry } from '../../src/games/cards/layout';
import type { GameDef } from '../../src/core/types';
import { g2048 } from '../../src/games/g2048/def';
import { createHarness } from './scenarios/harness';

/**
 * "Back to the start" keeps the points on screen. The trap is the obvious one:
 * replaying the same opening after a restart must not pay for it a second time.
 */

describe('restart scoring', () => {
  it('keeps the total where it was', () => {
    let s = applyScore(newScoreState(0), 30).state;
    s = restartScore(s, 0);
    expect(s.total).toBe(30);
    expect(s.streak).toBe(0);
  });

  it('pays nothing for winning back ground already won', () => {
    let s = applyScore(newScoreState(0), 30).state;
    for (let round = 0; round < 5; round++) {
      s = restartScore(s, 0);
      for (const base of [10, 20, 30]) s = applyScore(s, base).state;
      expect(s.total).toBe(30);
    }
  });

  it('pays again once play goes past the old position', () => {
    let s = applyScore(newScoreState(0), 30).state;
    s = restartScore(s, 0);
    s = applyScore(s, 45).state;
    expect(s.total).toBe(45);
  });

  it('a second restart keeps the higher of the two', () => {
    let s = applyScore(newScoreState(0), 30).state;
    s = restartScore(s, 0);
    s = applyScore(s, 50).state;
    s = restartScore(s, 0);
    expect(s.total).toBe(50);
  });

  it('survives the save file', () => {
    const s = restartScore(applyScore(newScoreState(0), 30).state, 0);
    const back = JSON.parse(JSON.stringify(s)) as typeof s;
    expect(applyScore(back, 10).state.total).toBe(30);
  });
});

describe('Session.restart', () => {
  for (const def of [klondike, g2048] as Array<GameDef<unknown>>) {
    it(`${def.id}: deals the same board again and keeps the score`, () => {
      const h = createHarness(def, { seed: 1234 });
      const dealt = JSON.stringify(h.state);
      h.session.commit((draft) => {
        // any change will do; the point is that restart undoes it
        (draft as unknown as Record<string, unknown>)['touched'] = true;
      });
      expect(JSON.stringify(h.state)).not.toBe(dealt);
      const before = h.score;

      expect(h.session.restart()).toBe(true);
      expect(JSON.stringify(h.state)).toBe(dealt);
      expect(h.score).toBe(before);
      expect(h.canUndo, 'the old board is gone, as the dialog says').toBe(false);
    });
  }
});

describe('the Klondike waste fan', () => {
  it('shows the last three cards side by side, the top one outermost', () => {
    const h = createHarness(klondike, { seed: 7 });
    const state = h.state;
    for (let i = 0; i < 5; i++) klondikeSpec.onStock!(state, h.session as never);

    for (const rtl of [false, true]) {
      const g = computeGeometry(state, klondikeSpec.layoutOf(state), {
        availableW: 900, availableH: 700, rtl, sizeScale: 1, fanCap: 0,
      });
      const xs = [0, 1, 2, 3, 4].map((i) => cardPosition(g, state, 'waste', i).x);
      const home = g.piles['waste']!.x;
      const step = Math.round(g.cardW * 0.3) * (rtl ? -1 : 1);
      expect(xs).toEqual([home, home, home, home + step, home + 2 * step]);
      // never reaches the first foundation
      const f0 = g.piles['f0']!.x;
      expect(Math.abs(xs[4]! - home) + g.cardW).toBeLessThan(Math.abs(f0 - home));
    }
  });
});
