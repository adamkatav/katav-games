import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { klondikeSpec } from '../../src/games/cards/klondike';
import { spiderSpec, collectSets, SPIDER_TABLEAU } from '../../src/games/cards/spider';
import { freecellSpec, maxMove, FREECELL_TABLEAU, FREECELL_CELLS } from '../../src/games/cards/freecell';
import type { CardSpec, CardState } from '../../src/games/cards/model';
import type { Card, Rank, Suit } from '../../src/games/cards/deck';

const rng = (seed = 1) => createRng(seed);
const every = (s: CardState): Card[] => Object.values(s.piles).flat();

const card = (rank: Rank, suit: Suit, id = rank * 10 + suit): Card =>
  ({ id, rank, suit, up: true });

/** An empty board with the game's own pile set, for hand-built positions. */
function blank(spec: CardSpec, difficulty?: string): CardState {
  const state = spec.deal(rng(), difficulty);
  for (const key of Object.keys(state.piles)) state.piles[key] = [];
  state.hidden0 = 0;
  return state;
}

describe('deck integrity', () => {
  it('klondike deals 52 distinct cards with 7 face up', () => {
    const s = klondikeSpec.deal(rng());
    const cards = every(s);
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);
    expect(cards.filter((c) => c.up)).toHaveLength(7);
  });

  it('freecell deals 52 face-up cards as 7/7/7/7/6/6/6/6', () => {
    const s = freecellSpec.deal(rng());
    expect(every(s)).toHaveLength(52);
    expect(every(s).every((c) => c.up)).toBe(true);
    expect(FREECELL_TABLEAU.map((p) => s.piles[p]!.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
  });

  it.each(['1', '2', '4'])('spider %s-suit deals 104 cards from that many suits', (d) => {
    const s = spiderSpec.deal(rng(), d);
    const cards = every(s);
    expect(cards).toHaveLength(104);
    expect(new Set(cards.map((c) => c.id)).size).toBe(104);
    expect(new Set(cards.map((c) => c.suit)).size).toBe(Number(d));
  });

  it('is reproducible from a seed', () => {
    const a = every(klondikeSpec.deal(rng(42))).map((c) => `${c.rank}.${c.suit}`);
    const b = every(klondikeSpec.deal(rng(42))).map((c) => `${c.rank}.${c.suit}`);
    expect(a).toEqual(b);
  });
});

describe('klondike placement', () => {
  it('opens an empty column with a king only', () => {
    const s = blank(klondikeSpec);
    expect(klondikeSpec.canDrop(s, [card(13, 0)], 't0', 't1')).toBe(true);
    expect(klondikeSpec.canDrop(s, [card(10, 2)], 't0', 't1')).toBe(false);
    expect(klondikeSpec.whyNot(s, [card(10, 2)], 't0')).toMatch(/מלך/);
  });

  it('needs descending rank and alternating colour', () => {
    const s = blank(klondikeSpec);
    s.piles['t0'] = [card(11, 2)];                 // red jack
    expect(klondikeSpec.canDrop(s, [card(10, 0)], 't0', 't1')).toBe(true);   // black ten
    expect(klondikeSpec.canDrop(s, [card(10, 1)], 't0', 't1')).toBe(false);  // red ten
    expect(klondikeSpec.canDrop(s, [card(9, 0)], 't0', 't1')).toBe(false);   // wrong rank
  });

  it('builds foundations from the ace, in suit', () => {
    const s = blank(klondikeSpec);
    expect(klondikeSpec.canDrop(s, [card(2, 0)], 'f0', 't0')).toBe(false);
    expect(klondikeSpec.canDrop(s, [card(1, 0)], 'f0', 't0')).toBe(true);
    s.piles['f0'] = [card(1, 0)];
    expect(klondikeSpec.canDrop(s, [card(2, 0)], 'f0', 't0')).toBe(true);
    expect(klondikeSpec.canDrop(s, [card(2, 1)], 'f0', 't0')).toBe(false);
  });
});

describe('freecell placement', () => {
  it('lets any card open an empty column, unlike klondike', () => {
    const s = blank(freecellSpec);
    expect(freecellSpec.canDrop(s, [card(10, 2)], 't0', 't1')).toBe(true);
  });

  it('holds exactly one card per free cell', () => {
    const s = blank(freecellSpec);
    expect(freecellSpec.canDrop(s, [card(10, 2)], 'e0', 't0')).toBe(true);
    s.piles['e0'] = [card(10, 2)];
    expect(freecellSpec.canDrop(s, [card(4, 0)], 'e0', 't0')).toBe(false);
    expect(freecellSpec.whyNot(s, [card(4, 0)], 'e0')).toMatch(/תפוס/);
  });

  it('limits run size by free cells and empty columns', () => {
    const s = blank(freecellSpec);
    for (const p of FREECELL_TABLEAU) s.piles[p] = [card(13, 0, Math.random())];
    expect(maxMove(s)).toBe(5);                        // 4 cells free, no empties

    FREECELL_CELLS.forEach((p, i) => { s.piles[p] = [card(2, 0, 900 + i)]; });
    expect(maxMove(s)).toBe(1);                        // all cells full

    const run = [card(8, 0), card(7, 1), card(6, 0)];
    s.piles['t0'] = [...run];
    s.piles['t1'] = [card(9, 1)];
    expect(freecellSpec.canDrop(s, run, 't1', 't0')).toBe(false);
    expect(freecellSpec.whyNot(s, run, 't1')).toMatch(/תאים פנויים/);
  });

  it('does not count the destination column as staging space', () => {
    const s = blank(freecellSpec);
    for (const p of FREECELL_TABLEAU) s.piles[p] = [card(13, 0, Math.random())];
    s.piles['t7'] = [];                                // one empty column
    expect(maxMove(s)).toBe(10);                       // (4+1) * 2^1
    expect(maxMove(s, 't7')).toBe(5);                  // moving into it forfeits it
  });
});

describe('spider', () => {
  it('stacks any suit but only moves same-suit runs together', () => {
    const s = blank(spiderSpec, '2');
    s.piles['t0'] = [card(8, 0)];
    s.piles['t1'] = [card(7, 1), card(6, 1)];
    expect(spiderSpec.canDrop(s, [card(7, 1)], 't0', 't1')).toBe(true);
    expect(spiderSpec.canGrab(s, 't1', 0)).toBe(true);

    s.piles['t1'] = [card(7, 1), card(6, 0)];          // mixed suits
    expect(spiderSpec.canGrab(s, 't1', 0)).toBe(false);
  });

  it('retires a completed king-to-ace run', () => {
    const s = blank(spiderSpec, '1');
    s.piles['t0'] = Array.from({ length: 13 }, (_, i) => card((13 - i) as Rank, 0, i));
    expect(collectSets(s)).toBe(1);
    expect(s.piles['t0']).toHaveLength(0);
    expect(s.piles['c0']).toHaveLength(13);
  });

  it('refuses to deal while a column is empty', () => {
    const s = spiderSpec.deal(rng(), '1');
    s.piles[SPIDER_TABLEAU[3]!] = [];
    const messages: string[] = [];
    const host = {
      state: s, settings: {} as never, sound: { bad() {} } as never,
      commit: () => { throw new Error('must not deal'); },
      toast: (m: string) => messages.push(m),
    };
    expect(spiderSpec.onStock!(s, host as never)).toBe(false);
    expect(messages[0]).toMatch(/טור ריק/);
  });
});
