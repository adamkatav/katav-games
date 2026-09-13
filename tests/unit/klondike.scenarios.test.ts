import { describe, expect, it } from 'vitest';
import { klondikeSpec } from '../../src/games/cards/klondike';
import {
  cardHarness, runCardScenarios, suitRun, type CardScenario,
} from './scenarios/cards';

/**
 * Klondike, state by state.
 *
 * Klondike ships a single mode, so "hardest" is the only one there is: one card
 * drawn at a time, unlimited redeals.
 *
 * Each case is a position, one action, and the whole board afterwards. A pile
 * missing from either literal must be empty, so a passing case also says what
 * did *not* move.
 */

const SCENARIOS: readonly CardScenario[] = [
  /* ---- the stock ------------------------------------------------------- */
  {
    name: 'drawing turns the top stock card face up onto the waste',
    given: { stock: '?5H ?9C', t0: 'KS' },
    when: (h) => { h.stock(); },
    then: { stock: '?5H', waste: '9C', t0: 'KS' },
    score: 0, moves: 1, sound: 'flip', toast: null,
  },
  {
    name: 'an empty stock turns the waste back over, in reverse',
    given: { waste: '5H 9C', t0: 'KS' },
    when: (h) => { h.stock(); },
    then: { stock: '?9C ?5H', t0: 'KS' },
    score: 0, moves: 1, sound: 'deal', toast: null,
  },
  {
    name: 'with the stock and the waste both empty, tapping it says so',
    given: { t0: 'KS' },
    when: (h) => { expect(h.stock()).toBe(false); },
    then: { t0: 'KS' },
    // Silence is the worst answer for this player: a tap that does nothing has
    // to explain itself, or it reads as the game being broken.
    moves: 0, canUndo: false, sound: 'bad', toast: /אין יותר קלפים/,
  },

  {
    name: 'dropping a card back on the deck explains the deck, not the tableau',
    given: { waste: '9C', t0: '10H' },
    when: (h) => { expect(h.try('t0', 0, 'waste')).toBe(false); },
    then: { waste: '9C', t0: '10H' },
    // It used to answer "put it on a card one bigger in the opposite colour",
    // which is true of a column and nonsense about the deck.
    moves: 0, sound: 'bad', toast: /להחזיר קלפים לחפיסה/,
  },

  /* ---- building down the tableau ---------------------------------------- */
  {
    name: 'a red ten goes onto a black jack',
    given: { t0: 'JS', t1: '10H' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: 'JS 10H' },
    score: 0, moves: 1, streak: 0, sound: 'place', toast: null,
  },
  {
    name: 'the same colour is refused, and the refusal says why',
    given: { t0: 'JS', t1: '10C' },
    when: (h) => { expect(h.try('t1', 0, 't0')).toBe(false); },
    then: { t0: 'JS', t1: '10C' },
    score: 0, moves: 0, sound: 'bad', toast: /צבע הפוך/, canUndo: false,
  },
  {
    name: 'a wrong rank is refused even with the colours right',
    given: { t0: 'JS', t1: '9H' },
    when: (h) => { expect(h.try('t1', 0, 't0')).toBe(false); },
    then: { t0: 'JS', t1: '9H' },
    moves: 0, sound: 'bad', toast: /צבע הפוך/,
  },
  {
    name: 'an alternating run moves as one piece',
    given: { t0: 'QS', t1: 'JH 10S 9H' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: 'QS JH 10S 9H' },
    score: 0, moves: 1, sound: 'place',
  },
  {
    name: 'the waste card plays onto the tableau',
    given: { waste: '9C', t0: '10H' },
    when: (h) => { h.try('waste', 0, 't0'); },
    then: { t0: '10H 9C' },
    score: 0, moves: 1, sound: 'place',
  },

  /* ---- empty columns ----------------------------------------------------- */
  {
    name: 'only a king may open an empty column',
    given: { t1: '10C' },
    when: (h) => { expect(h.try('t1', 0, 't0')).toBe(false); },
    then: { t1: '10C' },
    moves: 0, sound: 'bad', toast: /בטור ריק אפשר להניח רק מלך/,
  },
  {
    name: 'a king opens the column and turns over what it was sitting on',
    given: { t1: '?4D KS' },
    when: (h) => { h.try('t1', 1, 't0'); },
    then: { t0: 'KS', t1: '4D' },
    score: 10, moves: 1, streak: 1, sound: 'place', toast: null,
  },

  /* ---- the foundations --------------------------------------------------- */
  {
    name: 'a foundation starts at the ace',
    given: { t0: 'AH' },
    when: (h) => { h.try('t0', 0, 'f0'); },
    then: { f0: 'AH' },
    score: 15, moves: 1, streak: 1, sound: 'found',
  },
  {
    name: 'an empty foundation refuses anything but an ace',
    given: { t0: '2H' },
    when: (h) => { expect(h.try('t0', 0, 'f0')).toBe(false); },
    then: { t0: '2H' },
    score: 0, moves: 0, sound: 'bad', toast: /מתחילה באס/,
  },
  {
    name: 'a foundation continues in its own suit',
    given: { f0: 'AH', t0: '2H' },
    when: (h) => { h.try('t0', 0, 'f0'); },
    then: { f0: 'AH 2H' },
    score: 30, moves: 1, streak: 1, sound: 'found',
  },
  {
    name: 'a foundation refuses a different suit',
    given: { f0: 'AH', t0: '2S' },
    when: (h) => { expect(h.try('t0', 0, 'f0')).toBe(false); },
    then: { f0: 'AH', t0: '2S' },
    score: 15, moves: 0, sound: 'bad', toast: /קלף אחרי קלף/,
  },
  {
    name: 'a foundation takes one card at a time',
    given: { f0: 'AH', t0: '3S 2H' },
    when: (h) => { expect(h.try('t0', 0, 'f0')).toBe(false); },
    then: { f0: 'AH', t0: '3S 2H' },
    score: 15, moves: 0, sound: 'bad', toast: /קלף אחד בכל פעם/,
  },
  {
    name: 'a card may come back down from the foundation, and the score follows it',
    given: { f0: 'AH 2H', t0: '3S' },
    when: (h) => { h.try('f0', 1, 't0'); },
    then: { f0: 'AH', t0: '3S 2H' },
    score: 15, moves: 1, sound: 'place',
  },

  /* ---- scoring, streak and undo ------------------------------------------ */
  {
    name: 'a card shuffled between columns earns nothing the second time',
    given: { t0: '?3D 10H', t1: 'JC', t2: 'JS' },
    when: (h) => { h.try('t0', 1, 't1'); h.try('t1', 1, 't2'); },
    then: { t0: '3D', t1: 'JC', t2: 'JS 10H' },
    score: 10, moves: 2, streak: 1,
  },
  {
    name: 'undo puts the card back, face down, with the score and the streak it had',
    given: { t0: '?3D 10H', t1: 'JC' },
    when: (h) => { h.try('t0', 1, 't1'); expect(h.undo()).toBe(true); },
    then: { t0: '?3D 10H', t1: 'JC' },
    score: 0, moves: 0, streak: 0, canUndo: false,
  },
  {
    name: 'two scoring moves in a row build a streak, and the second pays a multiplier',
    given: { t0: '?3D 10H', t1: 'JC', t2: '?7S 9S', t3: '10D' },
    when: (h) => { h.try('t0', 1, 't1'); h.try('t2', 1, 't3'); },
    then: { t0: '3D', t1: 'JC 10H', t2: '7S', t3: '10D 9S' },
    // two cards turned over is 20 on the board; the ×1.5 at streak 2 adds 5.
    score: 25, moves: 2, streak: 2,
  },

  /* ---- the end of the round ---------------------------------------------- */
  {
    name: 'the last king completes the last foundation and wins the round',
    given: {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 12),
      t0: 'KC',
    },
    when: (h) => { h.try('t0', 0, 'f3'); },
    then: {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 13),
    },
    moves: 1, outcome: 'won',
  },
];

describe('klondike — state, action, state', () => {
  runCardScenarios(klondikeSpec, undefined, SCENARIOS);
});

describe('klondike — asking for help', () => {
  it('a hint costs the streak, because help is not the player’s own move', () => {
    const h = cardHarness(klondikeSpec, undefined, { t0: '?3D 10H', t1: 'JC', stock: '?2C' });
    h.try('t0', 1, 't1');
    expect(h.streak, 'the reveal should have started a streak').toBe(1);

    const hint = h.hint();
    expect(hint).not.toBeNull();
    expect(h.streak).toBe(0);
  });

  it('a hint that has nothing to suggest costs nothing', () => {
    const h = cardHarness(klondikeSpec, undefined, { t0: '?3D 10H', t1: 'JC' });
    h.try('t0', 1, 't1');
    expect(h.streak).toBe(1);

    expect(h.hint(), 'this position has no move and no stock').toBeNull();
    expect(h.streak, 'a hint that never came must not be charged for').toBe(1);
  });
});

describe('klondike — finishing', () => {
  it('pays the win bonus, awards five stars and records a personal best', () => {
    const h = cardHarness(klondikeSpec, undefined, {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 12),
      t0: 'KC',
    });
    const before = h.score;
    h.try('t0', 0, 'f3');

    expect(h.outcome).toBe('won');
    expect(h.summary?.stars, 'one move against a par of 135').toBe(5);
    expect(h.score, 'the win bonus is paid on top of the board').toBeGreaterThan(before + 15);
    expect(h.summary?.isBest).toBe(true);
    expect(h.saved, 'a finished round is not resumable').toBeNull();
  });

  it('refuses to act at all once the round is over', () => {
    const h = cardHarness(klondikeSpec, undefined, {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 12),
      t0: 'KC',
    });
    h.try('t0', 0, 'f3');
    expect(h.outcome).toBe('won');

    const settled = h.board();
    // A king onto an empty column is a legal move in any other position, so
    // this checks the engine is closed, not that the rules happen to refuse.
    h.try('f3', 12, 't1');
    expect(h.board(), 'a finished board must not keep moving').toEqual(settled);
    expect(h.moves).toBe(1);
  });

  it('will not undo a round that is already over', () => {
    const h = cardHarness(klondikeSpec, undefined, {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 12),
      t0: 'KC',
    });
    h.try('t0', 0, 'f3');
    expect(h.outcome).toBe('won');

    // Undo used to reach back past the win: the board rewound but the round
    // stayed finished, leaving a position that looked playable and refused
    // every move. A finished round is finished.
    expect(h.canUndo, 'the undo button must be dark once the round ends').toBe(false);
    expect(h.undo()).toBe(false);
    expect(h.outcome).toBe('won');
    expect(h.board()['f3']).toBe(suitRun('C', 1, 13));
  });
});
