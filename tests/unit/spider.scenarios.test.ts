import { describe, expect, it } from 'vitest';
import { spiderSpec } from '../../src/games/cards/spider';
import {
  cardHarness, runCardScenarios, suitRun, type Board, type CardScenario,
} from './scenarios/cards';

/**
 * Spider on the hardest setting: four suits, two full decks, ten columns.
 *
 * Four suits is where Spider's two rules pull against each other — any card may
 * sit on the next rank up, but only a same-suit run travels together — so these
 * cases lean on that seam.
 */
const HARD = '4';

/** Ten occupied columns of nothing that can stack: no move, only a deal. */
const STUCK: Board = {
  t0: 'KS', t1: 'KH', t2: 'KD', t3: 'KC', t4: 'JS',
  t5: 'JH', t6: 'JD', t7: 'JC', t8: 'KS', t9: 'KH',
};

const SCENARIOS: readonly CardScenario[] = [
  /* ---- stacking ---------------------------------------------------------- */
  {
    name: 'any suit may sit on the next rank up',
    given: { t0: '8S', t1: '7H' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: '8S 7H' },
    score: 0, moves: 1, sound: 'place', toast: null,
  },
  {
    name: 'a same-suit run travels as one piece, and pays for the join',
    given: { t0: '9D', t1: '8D 7D' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: '9D 8D 7D' },
    score: 10, moves: 1, streak: 1, sound: 'place',
  },
  {
    name: 'the wrong rank is refused, with the reason',
    given: { t0: '8S', t1: '6H' },
    when: (h) => { expect(h.try('t1', 0, 't0')).toBe(false); },
    then: { t0: '8S', t1: '6H' },
    moves: 0, sound: 'bad', toast: /קלף גדול באחד/,
  },
  {
    name: 'a card cannot be laid on one that is still face down',
    given: { t0: '?8S', t1: '7H' },
    when: (h) => { expect(h.try('t1', 0, 't0')).toBe(false); },
    then: { t0: '?8S', t1: '7H' },
    moves: 0, sound: 'bad', toast: /להפוך קודם/,
  },
  {
    name: 'any card may open an empty column',
    given: { t1: '7H' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: '7H' },
    score: 0, moves: 1, sound: 'place',
  },
  {
    name: 'moving off a face-down card turns it over',
    given: { t0: '?4C 8S', t1: '9S' },
    when: (h) => { h.try('t0', 1, 't1'); },
    then: { t0: '4C', t1: '9S 8S' },
    score: 15, moves: 1, streak: 1, sound: 'place',
  },
  {
    name: 'dropping a card on the deck explains the deck',
    given: { stock: '?2S', t0: '8S' },
    when: (h) => { expect(h.try('t0', 0, 'stock')).toBe(false); },
    then: { stock: '?2S', t0: '8S' },
    // The deck is face down, so the old answer — "turn that card over first" —
    // sent the player looking for something to turn over.
    moves: 0, sound: 'bad', toast: /על החפיסה/,
  },
  {
    name: 'the completed piles fill themselves and refuse a card by hand',
    given: { t0: 'KH' },
    when: (h) => { expect(h.try('t0', 0, 'c0')).toBe(false); },
    then: { t0: 'KH' },
    moves: 0, sound: 'bad', toast: /מתמלאות לבד/,
  },

  /* ---- completing a set --------------------------------------------------- */
  {
    name: 'king down to ace retires the set and says so',
    given: { t0: suitRun('S', 13, 2), t1: 'AS' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { c0: suitRun('S', 13, 1) },
    score: 150, moves: 1, streak: 1,
    soundsInclude: ['set', 'place'], toast: /סדרה הושלמה/,
  },
  {
    name: 'undo takes a completed set back out of its pile',
    given: { t0: suitRun('S', 13, 2), t1: 'AS' },
    when: (h) => { h.try('t1', 0, 't0'); expect(h.undo()).toBe(true); },
    then: { t0: suitRun('S', 13, 2), t1: 'AS' },
    score: 55, moves: 0, streak: 0, canUndo: false,
  },
  {
    name: 'a run of the wrong suits is not a set, however long it is',
    given: { t0: `${suitRun('S', 13, 3)} 2H`, t1: 'AH' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: `${suitRun('S', 13, 3)} 2H AH` },
    // ten same-suit joins plus the 2H-AH one: no set, so no 150.
    score: 55, moves: 1,
  },

  /* ---- the stock ---------------------------------------------------------- */
  {
    name: 'a deal puts one card face up on every column',
    given: { ...STUCK, stock: '?2S ?2H ?2D ?2C ?3S ?3H ?3D ?3C ?4S ?4H' },
    when: (h) => { expect(h.stock()).toBe(true); },
    then: {
      t0: 'KS 4H', t1: 'KH 4S', t2: 'KD 3C', t3: 'KC 3D', t4: 'JS 3H',
      t5: 'JH 3S', t6: 'JD 2C', t7: 'JC 2D', t8: 'KS 2H', t9: 'KH 2S',
    },
    score: 0, moves: 1, toast: null,
  },
  {
    name: 'a deal is refused while a column stands empty, and names the rule',
    given: { ...STUCK, t9: '', stock: '?2S ?2H ?2D ?2C ?3S ?3H ?3D ?3C ?4S ?4H' },
    when: (h) => { expect(h.stock()).toBe(false); },
    then: { ...STUCK, t9: '', stock: '?2S ?2H ?2D ?2C ?3S ?3H ?3D ?3C ?4S ?4H' },
    moves: 0, sound: 'bad', toast: /טור ריק/,
  },
  {
    name: 'a deal is refused when the stock is gone',
    given: STUCK,
    when: (h) => { expect(h.stock()).toBe(false); },
    then: STUCK,
    moves: 0, sound: 'bad', toast: /אין יותר קלפים בחפיסה/,
  },

  /* ---- scoring ------------------------------------------------------------ */
  {
    name: 'breaking a join and rebuilding it elsewhere earns nothing twice',
    given: { t0: '9S 8S', t1: '9H', t2: 'KC' },
    when: (h) => { h.try('t0', 1, 't1'); h.try('t1', 1, 't0'); },
    then: { t0: '9S 8S', t1: '9H', t2: 'KC' },
    score: 5, moves: 2, streak: 0,
  },

  /* ---- the end of the round ----------------------------------------------- */
  {
    name: 'the eighth set ends the round',
    given: {
      c0: suitRun('S', 13, 1), c1: suitRun('S', 13, 1), c2: suitRun('H', 13, 1),
      c3: suitRun('H', 13, 1), c4: suitRun('D', 13, 1), c5: suitRun('D', 13, 1),
      c6: suitRun('C', 13, 1),
      t0: suitRun('C', 13, 2), t1: 'AC',
    },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: {
      c0: suitRun('S', 13, 1), c1: suitRun('S', 13, 1), c2: suitRun('H', 13, 1),
      c3: suitRun('H', 13, 1), c4: suitRun('D', 13, 1), c5: suitRun('D', 13, 1),
      c6: suitRun('C', 13, 1), c7: suitRun('C', 13, 1),
    },
    moves: 1, outcome: 'won',
  },
];

describe('spider (four suits) — state, action, state', () => {
  runCardScenarios(spiderSpec, HARD, SCENARIOS);
});

describe('spider (four suits) — what the player may pick up', () => {
  const h = () => cardHarness(spiderSpec, HARD, { t0: '9S 8H 7H', t1: '?9D 8D' });

  it('refuses a run whose suits are mixed', () => {
    expect(spiderSpec.canGrab(h().state, 't0', 0), '9S under 8H is not a run').toBe(false);
  });

  it('allows the same-suit tail of that run', () => {
    expect(spiderSpec.canGrab(h().state, 't0', 1), '8H-7H is').toBe(true);
  });

  it('refuses a face-down card', () => {
    expect(spiderSpec.canGrab(h().state, 't1', 0)).toBe(false);
  });

  it('refuses the stock and the completed piles', () => {
    const state = cardHarness(spiderSpec, HARD, { stock: '?9D', c0: suitRun('S', 13, 1) }).state;
    expect(spiderSpec.canGrab(state, 'stock', 0)).toBe(false);
    expect(spiderSpec.canGrab(state, 'c0', 12)).toBe(false);
  });
});

describe('spider (four suits) — hints', () => {
  it('suggests a deal when the board has no move left, and says what it is suggesting', () => {
    const h = cardHarness(spiderSpec, HARD, { ...STUCK, stock: '?2S' });
    const hint = h.hint();
    expect(hint).toEqual({
      kind: 'pile', pile: 'stock', message: expect.stringContaining('לחלק'),
    });
  });

  it('prefers a move that turns a card over', () => {
    const h = cardHarness(spiderSpec, HARD, {
      ...STUCK, t0: '?7C 8S', t4: '9S', stock: '?2S',
    });
    expect(h.hint()).toEqual({ kind: 'move', from: 't0', index: 1, to: 't4' });
  });

  it('has nothing to say on a board with neither a move nor a stock', () => {
    expect(cardHarness(spiderSpec, HARD, STUCK).hint()).toBeNull();
  });
});
