import { describe, expect, it } from 'vitest';
import { freecellSpec } from '../../src/games/cards/freecell';
import {
  cardHarness, runCardScenarios, suitRun, type Board, type CardScenario,
} from './scenarios/cards';

/**
 * FreeCell, state by state. One mode only — every card is face up from the
 * start, which is the whole game.
 *
 * The cases below lean on the one rule that makes FreeCell FreeCell: how many
 * cards may travel together is not a property of the run, it is a property of
 * the rest of the board.
 */

/**
 * Four cells full and all eight columns occupied: nothing at all to stage with,
 * so exactly one card may move. `t0` holds a legal pair and `t6` would accept
 * it — the rules of the run are fine; the room is not.
 */
const CRAMPED: Board = {
  e0: '2S', e1: '2H', e2: '2D', e3: '2C',
  t0: '8S 7H', t1: 'KS', t2: 'KH', t3: 'KD', t4: 'KC', t5: 'QS', t6: '9D', t7: 'QH',
};

const SCENARIOS: readonly CardScenario[] = [
  /* ---- the free cells ---------------------------------------------------- */
  {
    name: 'a card parks in a free cell',
    given: { t0: '5H', t1: 'KS' },
    when: (h) => { h.try('t0', 0, 'e0'); },
    then: { e0: '5H', t1: 'KS' },
    score: 0, moves: 1, sound: 'place', toast: null,
  },
  {
    name: 'a cell holds exactly one card',
    given: { e0: '5H', t0: '4S' },
    when: (h) => { expect(h.try('t0', 0, 'e0')).toBe(false); },
    then: { e0: '5H', t0: '4S' },
    moves: 0, sound: 'bad', toast: /תפוס/,
  },
  {
    name: 'a parked card comes back down onto the tableau',
    given: { e0: '5H', t0: '6S' },
    when: (h) => { h.try('e0', 0, 't0'); },
    then: { t0: '6S 5H' },
    score: 3, moves: 1, streak: 1, sound: 'place',
  },
  {
    name: 'a parked card can go straight up to a foundation',
    given: { e0: 'AS', t0: 'KH' },
    when: (h) => { h.try('e0', 0, 'f0'); },
    then: { f0: 'AS', t0: 'KH' },
    score: 15, moves: 1, sound: 'found',
  },

  /* ---- empty columns ----------------------------------------------------- */
  {
    name: 'any card may open an empty column, unlike Klondike',
    given: { t1: '7D' },
    when: (h) => { h.try('t1', 0, 't0'); },
    then: { t0: '7D' },
    score: 0, moves: 1, sound: 'place',
  },

  /* ---- how many cards may travel together -------------------------------- */
  {
    name: 'with every cell full a run of two is one card too many',
    given: CRAMPED,
    when: (h) => { expect(h.try('t0', 0, 't6')).toBe(false); },
    then: CRAMPED,
    score: 3, moves: 0, sound: 'bad', toast: /אין מספיק תאים פנויים/,
  },
  {
    name: 'the same run moves once a single cell is free',
    given: { ...CRAMPED, e3: '' },
    when: (h) => { h.try('t0', 0, 't6'); },
    then: {
      e0: '2S', e1: '2H', e2: '2D',
      t1: 'KS', t2: 'KH', t3: 'KD', t4: 'KC', t5: 'QS', t6: '9D 8S 7H', t7: 'QH',
    },
    score: 6, moves: 1, streak: 1, sound: 'place',
  },
  {
    name: 'an empty column doubles what can move — but not when it is the destination',
    given: { ...CRAMPED, t6: '' },
    when: (h) => {
      expect(h.try('t0', 0, 't6'), 'the destination cannot also be the staging area').toBe(false);
    },
    then: { ...CRAMPED, t6: '' },
    score: 3, moves: 0, sound: 'bad', toast: /אין מספיק תאים פנויים/,
  },
  {
    name: 'that same empty column does let two cards reach a different one',
    given: { ...CRAMPED, t6: '', t7: '9D' },
    when: (h) => { h.try('t0', 0, 't7'); },
    then: {
      e0: '2S', e1: '2H', e2: '2D', e3: '2C',
      t1: 'KS', t2: 'KH', t3: 'KD', t4: 'KC', t5: 'QS', t7: '9D 8S 7H',
    },
    score: 6, moves: 1, sound: 'place',
  },

  /* ---- the foundations --------------------------------------------------- */
  {
    name: 'a foundation starts at the ace',
    given: { t0: 'AD' },
    when: (h) => { h.try('t0', 0, 'f0'); },
    then: { f0: 'AD' },
    score: 15, moves: 1, sound: 'found',
  },
  {
    name: 'a foundation refuses a different suit',
    given: { f0: 'AD', t0: '2H' },
    when: (h) => { expect(h.try('t0', 0, 'f0')).toBe(false); },
    then: { f0: 'AD', t0: '2H' },
    score: 15, moves: 0, sound: 'bad', toast: /קלף אחרי קלף/,
  },
  {
    name: 'a foundation takes one card at a time',
    given: { f0: 'AD', t0: '3S 2D' },
    when: (h) => { expect(h.try('t0', 0, 'f0')).toBe(false); },
    then: { f0: 'AD', t0: '3S 2D' },
    moves: 0, sound: 'bad', toast: /קלף אחד בכל פעם/,
  },

  /* ---- scoring and undo --------------------------------------------------- */
  {
    name: 'parking a card and taking it back leaves the score exactly where it was',
    given: { t0: '6S 5H', t1: 'KS' },
    when: (h) => { h.try('t0', 1, 'e0'); h.try('e0', 0, 't0'); },
    then: { t0: '6S 5H', t1: 'KS' },
    score: 3, moves: 2, streak: 0,
  },
  {
    name: 'undo restores the run, the score and the streak',
    given: { t0: '8S 7H', t1: '9D' },
    when: (h) => { h.try('t0', 0, 't1'); expect(h.undo()).toBe(true); },
    then: { t0: '8S 7H', t1: '9D' },
    score: 3, moves: 0, streak: 0, canUndo: false,
  },

  /* ---- the end of the round ---------------------------------------------- */
  {
    name: 'the last king completes the last foundation and wins the round',
    given: {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 12),
      e0: 'KC',
    },
    when: (h) => { h.try('e0', 0, 'f3'); },
    then: {
      f0: suitRun('S', 1, 13),
      f1: suitRun('H', 1, 13),
      f2: suitRun('D', 1, 13),
      f3: suitRun('C', 1, 13),
    },
    moves: 1, outcome: 'won',
  },
];

describe('freecell — state, action, state', () => {
  runCardScenarios(freecellSpec, undefined, SCENARIOS);
});

describe('freecell — the position always has something to do', () => {
  it('charges the streak for a hint', () => {
    const h = cardHarness(freecellSpec, undefined, { t0: '6S 5H', t1: '7D' });
    h.try('t0', 0, 't1');                 // 7D-6S-5H: one more ordered pair
    expect(h.score).toBe(6);
    expect(h.streak).toBe(1);

    expect(h.hint(), 'a card can always be parked, so a hint always exists').not.toBeNull();
    expect(h.streak, 'help costs the streak').toBe(0);
  });

  it('reports how many cells are free, which is the stat that matters here', () => {
    const h = cardHarness(freecellSpec, undefined, { e0: '2S', e1: '2H', t0: 'KS' });
    expect(freecellSpec.stat?.(h.state)).toEqual({ label: 'תאים פנויים', value: '2/4' });
  });
});
