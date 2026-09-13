import { describe, expect, it } from 'vitest';
import { g2048 } from '../../src/games/g2048/def';
import { createHarness } from './scenarios/harness';
import {
  buildG2048, g2048Harness, renderG2048, runG2048Scenarios, type G2048Scenario, type Picture,
} from './scenarios/g2048';

/**
 * 2048 has one mode, so this is the hardest it gets.
 *
 * The direction pressed is the whole action, and the interesting states are the
 * ones where sliding and merging disagree with each other: a row that merges
 * twice, a tile that must not merge twice, and a press into a wall.
 */

/** A picture with a first row of its own, since most cases only need one. */
const topRow = (row: string): Picture => [row, '. . . .', '. . . .', '. . . .'];

const SCENARIOS: readonly G2048Scenario[] = [
  /* ---- sliding ----------------------------------------------------------- */
  {
    name: 'sliding left packs the row against the wall',
    given: topRow('. 2 . 4'),
    when: (h) => { expect(h.push('left')).toBe(true); },
    then: topRow('2 4 . .'),
    score: 0, moves: 1, sound: 'place', toast: null,
  },
  {
    name: 'sliding right packs it the other way',
    given: topRow('2 . 4 .'),
    when: (h) => { h.push('right'); },
    then: topRow('. . 2 4'),
    score: 0, moves: 1,
  },
  {
    name: 'sliding up packs the column to the top',
    given: ['. . . .', '2 . . .', '. . . .', '4 . . .'],
    when: (h) => { h.push('up'); },
    then: ['2 . . .', '4 . . .', '. . . .', '. . . .'],
    score: 0, moves: 1,
  },
  {
    name: 'sliding down packs it to the bottom',
    given: ['2 . . .', '. . . .', '4 . . .', '. . . .'],
    when: (h) => { h.push('down'); },
    then: ['. . . .', '. . . .', '2 . . .', '4 . . .'],
    score: 0, moves: 1,
  },
  {
    name: 'pressing into a wall changes nothing, and is not a move',
    given: topRow('2 4 . .'),
    when: (h) => { expect(h.push('left')).toBe(false); },
    then: topRow('2 4 . .'),
    spawned: 0,
    score: 0, moves: 0, canUndo: false, sound: 'bad',
  },

  /* ---- merging ------------------------------------------------------------ */
  {
    name: 'two equal tiles become one worth double',
    given: topRow('2 2 . .'),
    when: (h) => { h.push('left'); },
    then: topRow('4 . . .'),
    score: 4, moves: 1, streak: 1,
  },
  {
    name: 'a full row of the same tile makes two, not one',
    given: topRow('2 2 2 2'),
    when: (h) => { h.push('left'); },
    then: topRow('4 4 . .'),
    score: 8, moves: 1,
  },
  {
    name: 'the pair nearest the wall merges first',
    given: topRow('4 2 2 .'),
    when: (h) => { h.push('left'); },
    then: topRow('4 4 . .'),
    score: 4, moves: 1,
  },
  {
    name: 'a tile that has just merged will not merge again in the same press',
    given: topRow('4 2 2 4'),
    when: (h) => { h.push('left'); },
    then: topRow('4 4 4 .'),
    score: 4, moves: 1,
  },
  {
    name: 'unequal tiles only shuffle up against each other',
    given: topRow('2 4 2 4'),
    when: (h) => { expect(h.push('left'), 'nothing can move or merge').toBe(false); },
    then: topRow('2 4 2 4'),
    spawned: 0, score: 0, moves: 0, sound: 'bad',
  },
  {
    name: 'merges add to the score already banked',
    given: topRow('8 8 . .'),
    startingScore: 100,
    when: (h) => { h.push('left'); },
    then: topRow('16 . . .'),
    score: 116, moves: 1,
  },

  /* ---- the end of the round ------------------------------------------------ */
  {
    name: 'making 2048 wins the round',
    given: topRow('1024 1024 . .'),
    when: (h) => { h.push('left'); },
    then: topRow('2048 . . .'),
    moves: 1, outcome: 'won',
  },
  {
    name: 'a board with nowhere left to go is lost',
    given: [
      '8 16 8 16',
      '16 8 16 8',
      '8 16 8 .',
      '16 8 16 16',
    ],
    when: (h) => { expect(h.push('up')).toBe(true); },
    then: [
      '8 16 8 16',
      '16 8 16 8',
      '8 16 8 16',
      '16 8 16 .',
    ],
    // whatever spawns in the last square, 2 or 4, it touches nothing it matches
    moves: 1, outcome: 'lost', score: 0,
  },
];

describe('2048 — state, action, state', () => {
  runG2048Scenarios(SCENARIOS);
});

describe('2048 — undo', () => {
  it('takes back the slide, the tile that spawned and the score', () => {
    const h = g2048Harness(topRow('2 2 . .'));
    h.push('left');
    expect(h.score).toBe(4);
    expect(h.state.tiles).toHaveLength(2);       // the merged 4 and the new tile

    expect(h.undo()).toBe(true);
    expect(h.picture()).toEqual([...topRow('2 2 . .')]);
    expect(h.score).toBe(0);
    expect(h.moves).toBe(0);
    expect(h.state.spawns, 'undo must rewind the spawn counter, or the board diverges').toBe(0);
  });

  it('replays the identical tile after an undo, because spawns come from the seed', () => {
    const h = g2048Harness(topRow('2 2 . .'), { seed: 4242 });
    h.push('left');
    const first = renderG2048(h.state);
    h.undo();
    h.push('left');

    expect(h.picture(), 'the same move from the same position must deal the same tile')
      .toEqual(first);
    expect(h.score, 'and it must not pay for the merge twice').toBe(4);
  });
});

describe('2048 — reaching the target', () => {
  it('lets the player carry on past 2048, which is what the help promises', () => {
    const h = g2048Harness(topRow('1024 1024 . .'));
    h.push('left');
    expect(h.outcome).toBe('won');
    expect(h.state.reached).toBe(true);

    expect(h.session.continueRound(), 'a won 2048 round can be resumed').toBe(true);
    expect(h.outcome).toBe('playing');
    expect(h.state.keepGoing).toBe(true);
    expect(g2048.isWon(h.state), 'and it must not win again on the next move').toBe(false);

    h.push('left');
    expect(h.outcome, 'the round now ends only when the board fills up').toBe('playing');
  });

  it('offers nothing to continue in a game that has no such thing', () => {
    const h = g2048Harness(topRow('2 2 . .'));
    expect(h.session.continueRound(), 'the round is still being played').toBe(false);
  });

  it('will not undo a round that is already over', () => {
    const h = g2048Harness([
      '8 16 8 16',
      '16 8 16 8',
      '8 16 8 .',
      '16 8 16 16',
    ]);
    h.push('up');
    expect(h.outcome).toBe('lost');
    expect(h.canUndo, 'undo would hand back a board the round has finished with').toBe(false);
    expect(h.undo()).toBe(false);
  });
});

describe('2048 — hints', () => {
  it('suggests a direction that does something, and says which', () => {
    const h = g2048Harness(topRow('2 2 . .'));
    const hint = h.hint();
    expect(hint?.kind).toBe('cell');
    expect(hint && 'message' in hint ? hint.message : '').toMatch(/שמאלה|ימינה|למעלה|למטה/);
  });

  it('prefers the direction that merges', () => {
    const h = g2048Harness(['2 . . 2', '. . . .', '. . . .', '4 . . .']);
    const hint = h.hint();
    // Left merges the two 2s; up only shuffles.
    expect(hint && 'message' in hint ? hint.message : '').toMatch(/שמאלה/);
  });

  it('has nothing to suggest when the board is finished', () => {
    const h = g2048Harness([
      '8 16 8 16',
      '16 8 16 8',
      '8 16 8 16',
      '16 8 16 8',
    ]);
    expect(h.hint()).toBeNull();
    expect(g2048.isLost?.(h.state)).toBe(true);
  });
});

describe('2048 — the deal', () => {
  it('opens with two tiles and nothing else', () => {
    const h = createHarness(g2048, { seed: 5 });
    expect(h.state.tiles).toHaveLength(2);
    expect(h.state.tiles.every((t) => t.value === 2 || t.value === 4)).toBe(true);
    expect(new Set(h.state.tiles.map((t) => t.at)).size, 'two tiles, two squares').toBe(2);
    expect(h.score).toBe(0);
    expect(h.outcome).toBe('playing');
  });

  it('keeps the state JSON-serialisable, which undo and resume depend on', () => {
    const state = buildG2048(topRow('2 2 . .'));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('reports the biggest tile, which is the number the player is chasing', () => {
    const h = g2048Harness(topRow('2 512 . 8'));
    expect(g2048.createView(h.session).stat?.(h.state)).toEqual({ label: 'הכי גדול', value: '512' });
  });
});
