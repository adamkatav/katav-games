import type { Hint, Rng, ViewHost } from '../../core/types';
import { buildDeck, ids, isAlternatingRun, isRed, topOf, type Card, type PileId } from './deck';
import { createCardGame, hiddenCount, revealTop, type CardSpec, type CardState } from './model';

const TABLEAU = ids('t', 7);
const FOUNDATIONS = ids('f', 4);

export const klondikeSpec: CardSpec = {
  id: 'klondike',
  name: 'סוליטר',
  emoji: '🂡',
  blurb: 'המשחק הקלאסי — לאסוף מאס עד מלך',

  deal(rng: Rng): CardState {
    const deck = rng.shuffle(buildDeck([0, 1, 2, 3], 1));
    const piles: CardState['piles'] = { stock: [], waste: [] };
    for (const p of FOUNDATIONS) piles[p] = [];
    for (const p of TABLEAU) piles[p] = [];

    TABLEAU.forEach((pile, c) => {
      for (let k = 0; k <= c; k++) {
        const card = deck.pop()!;
        card.up = k === c;
        piles[pile]!.push(card);
      }
    });
    piles['stock'] = deck;

    const state: CardState = { piles, hidden0: 0 };
    state.hidden0 = hiddenCount(state, TABLEAU);
    return state;
  },

  layoutOf: () => ({
    columns: 7,
    top: [
      { pile: 'stock', col: 0 },
      { pile: 'waste', col: 1 },
      ...FOUNDATIONS.map((pile, i) => ({ pile, col: 3 + i })),
    ],
    tableau: TABLEAU,
    stacked: ['stock', 'waste', ...FOUNDATIONS],
  }),

  canGrab(state, pile, index) {
    const cards = state.piles[pile];
    if (!cards || index < 0 || index >= cards.length) return false;
    if (pile === 'stock') return false;
    if (pile === 'waste') return index === cards.length - 1;
    if (FOUNDATIONS.includes(pile)) return index === cards.length - 1;
    const run = cards.slice(index);
    return run.every((c) => c.up) && isAlternatingRun(run);
  },

  canDrop(state, run, dest, from) {
    if (dest === from || dest === 'stock' || dest === 'waste') return false;
    const card = run[0];
    if (!card) return false;
    const t = topOf(state.piles, dest);

    if (FOUNDATIONS.includes(dest)) {
      if (run.length !== 1) return false;
      return t ? t.suit === card.suit && t.rank === card.rank - 1 : card.rank === 1;
    }
    if (!t) return card.rank === 13;                 // only a king opens a column
    return t.up && t.rank === card.rank + 1 && isRed(t) !== isRed(card);
  },

  whyNot(state, run, dest) {
    const t = topOf(state.piles, dest);
    if (FOUNDATIONS.includes(dest)) {
      if (run.length > 1) return 'לערימת הסיום מעבירים קלף אחד בכל פעם';
      return t ? 'בערימת הסיום ממשיכים באותה צורה, קלף אחרי קלף' : 'ערימת הסיום מתחילה באס';
    }
    if (!t) return 'בטור ריק אפשר להניח רק מלך';
    if (!t.up) return 'צריך להפוך קודם את הקלף הזה';
    return 'צריך להניח על קלף גדול באחד ובצבע הפוך';
  },

  onStock(state, host: ViewHost<CardState>) {
    const { stock, waste } = state.piles as { stock: Card[]; waste: Card[] };
    if (stock.length === 0 && waste.length === 0) return false;
    host.commit((draft) => {
      const s = draft.piles['stock']!, w = draft.piles['waste']!;
      if (s.length > 0) {
        const card = s.pop()!;
        card.up = true;
        w.push(card);
        host.sound.flip();
      } else {
        // recycle: the waste turns back over into the stock
        while (w.length > 0) { const c = w.pop()!; c.up = false; s.push(c); }
        host.sound.deal(0);
      }
    });
    return true;
  },

  afterMove(state) {
    for (const p of TABLEAU) revealTop(state.piles, p);
  },

  score(state) {
    const revealed = (state.hidden0 - hiddenCount(state, TABLEAU)) * 10;
    const onFoundations = FOUNDATIONS.reduce((n, p) => n + (state.piles[p]?.length ?? 0), 0);
    return revealed + onFoundations * 15;
  },

  isWon: (state) => FOUNDATIONS.every((p) => (state.piles[p]?.length ?? 0) === 13),

  hint(state): Hint | null {
    const move = (from: PileId, index: number, to: PileId): Hint =>
      ({ kind: 'move', from, index, to });

    // 1. a move that turns a face-down card over
    for (const p of TABLEAU) {
      const cards = state.piles[p]!;
      const i = cards.findIndex((c) => c.up);
      if (i > 0 && this.canGrab(state, p, i)) {
        const run = cards.slice(i);
        const to = TABLEAU.find((d) => (state.piles[d]?.length ?? 0) > 0 && this.canDrop(state, run, d, p));
        if (to) return move(p, i, to);
      }
    }
    // 2. anything that can go up
    for (const p of ['waste', ...TABLEAU]) {
      const t = topOf(state.piles, p);
      if (!t || !t.up) continue;
      const f = FOUNDATIONS.find((d) => this.canDrop(state, [t], d, p));
      if (f) return move(p, state.piles[p]!.length - 1, f);
    }
    // 3. play the waste card
    const w = topOf(state.piles, 'waste');
    if (w) {
      const to = TABLEAU.find((d) => this.canDrop(state, [w], d, 'waste'));
      if (to) return move('waste', state.piles['waste']!.length - 1, to);
    }
    // 4. a king into an empty column
    for (const p of TABLEAU) {
      const cards = state.piles[p]!;
      const i = cards.findIndex((c) => c.up);
      if (i > 0 && cards[i]!.rank === 13 && this.canGrab(state, p, i)) {
        const to = TABLEAU.find((d) => (state.piles[d]?.length ?? 0) === 0);
        if (to) return move(p, i, to);
      }
    }
    // 5. any tableau move at all, then the stock
    for (const p of TABLEAU) {
      const cards = state.piles[p]!;
      const i = cards.findIndex((c) => c.up);
      if (i < 0 || !this.canGrab(state, p, i)) continue;
      const run = cards.slice(i);
      const to = TABLEAU.find((d) => (state.piles[d]?.length ?? 0) > 0 && this.canDrop(state, run, d, p));
      if (to) return move(p, i, to);
    }
    if ((state.piles['stock']?.length ?? 0) > 0 || (state.piles['waste']?.length ?? 0) > 0) {
      return { kind: 'pile', pile: 'stock', message: 'אפשר לקחת קלף מהחפיסה' };
    }
    return null;
  },

  par: () => ({ moves: 135, time: 420 }),
};

export const klondike = createCardGame(klondikeSpec);
export { TABLEAU as KLONDIKE_TABLEAU, FOUNDATIONS as KLONDIKE_FOUNDATIONS };
