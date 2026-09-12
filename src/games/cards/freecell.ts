import type { Hint, Rng } from '../../core/types';
import { buildDeck, ids, isAlternatingRun, isRed, topOf, type PileId } from './deck';
import { createCardGame, type CardSpec, type CardState } from './model';

const TABLEAU = ids('t', 8);
const FOUNDATIONS = ids('f', 4);
const CELLS = ids('e', 4);

/**
 * How many cards may move as a unit: every free cell doubles the run you can
 * shuffle through, and every empty column doubles it again. A destination
 * column that is itself empty cannot also be used as a staging area.
 */
export function maxMove(state: CardState, dest?: PileId): number {
  const free = CELLS.filter((p) => (state.piles[p]?.length ?? 0) === 0).length;
  let empties = TABLEAU.filter((p) => (state.piles[p]?.length ?? 0) === 0).length;
  if (dest && TABLEAU.includes(dest) && (state.piles[dest]?.length ?? 0) === 0) empties--;
  return (free + 1) * Math.pow(2, Math.max(0, empties));
}

export const freecellSpec: CardSpec = {
  id: 'freecell',
  name: 'פריסל',
  emoji: '🃏',
  blurb: 'כל הקלפים גלויים — משחק של חשיבה',

  deal(rng: Rng): CardState {
    const deck = rng.shuffle(buildDeck([0, 1, 2, 3], 1));
    const piles: CardState['piles'] = {};
    for (const p of [...CELLS, ...FOUNDATIONS, ...TABLEAU]) piles[p] = [];
    deck.forEach((card, k) => {
      card.up = true;                       // full information from the start
      piles[TABLEAU[k % 8]!]!.push(card);
    });
    return { piles, hidden0: 0 };
  },

  layoutOf: () => ({
    columns: 8,
    top: [
      ...CELLS.map((pile, i) => ({ pile, col: i })),
      ...FOUNDATIONS.map((pile, i) => ({ pile, col: 4 + i })),
    ],
    tableau: TABLEAU,
    stacked: [...CELLS, ...FOUNDATIONS],
  }),

  canGrab(state, pile, index) {
    const cards = state.piles[pile];
    if (!cards || index < 0 || index >= cards.length) return false;
    if (CELLS.includes(pile) || FOUNDATIONS.includes(pile)) return index === cards.length - 1;
    return isAlternatingRun(cards.slice(index));
  },

  canDrop(state, run, dest, from) {
    if (dest === from) return false;
    const card = run[0];
    if (!card) return false;
    const t = topOf(state.piles, dest);

    if (CELLS.includes(dest)) return run.length === 1 && !t;
    if (FOUNDATIONS.includes(dest)) {
      if (run.length !== 1) return false;
      return t ? t.suit === card.suit && t.rank === card.rank - 1 : card.rank === 1;
    }
    if (run.length > maxMove(state, dest)) return false;
    return t ? t.rank === card.rank + 1 && isRed(t) !== isRed(card) : true;
  },

  whyNot(state, run, dest) {
    const t = topOf(state.piles, dest);
    if (CELLS.includes(dest)) return t ? 'התא הזה תפוס' : 'לתא פנוי אפשר להעביר קלף אחד בלבד';
    if (FOUNDATIONS.includes(dest)) {
      if (run.length > 1) return 'לערימת הסיום מעבירים קלף אחד בכל פעם';
      return t ? 'בערימת הסיום ממשיכים באותה צורה, קלף אחרי קלף' : 'ערימת הסיום מתחילה באס';
    }
    if (run.length > maxMove(state, dest)) {
      return 'אין מספיק תאים פנויים כדי להעביר כל כך הרבה קלפים יחד';
    }
    return 'צריך להניח על קלף גדול באחד ובצבע הפוך';
  },

  score(state) {
    const onFoundations = FOUNDATIONS.reduce((n, p) => n + (state.piles[p]?.length ?? 0), 0);
    // No face-down cards to reveal, so reward ordered building in the tableau.
    let ordered = 0;
    for (const p of TABLEAU) {
      const cards = state.piles[p] ?? [];
      for (let i = 1; i < cards.length; i++) {
        const a = cards[i - 1]!, b = cards[i]!;
        if (b.rank === a.rank - 1 && isRed(a) !== isRed(b)) ordered++;
      }
    }
    return onFoundations * 15 + ordered * 3;
  },

  isWon: (state) => FOUNDATIONS.every((p) => (state.piles[p]?.length ?? 0) === 13),

  hint(state): Hint | null {
    const move = (from: PileId, index: number, to: PileId): Hint =>
      ({ kind: 'move', from, index, to });

    // 1. anything that can go up is real progress
    for (const p of [...TABLEAU, ...CELLS]) {
      const t = topOf(state.piles, p);
      if (!t) continue;
      const f = FOUNDATIONS.find((d) => this.canDrop(state, [t], d, p));
      if (f) return move(p, state.piles[p]!.length - 1, f);
    }
    // 2. empty a cell back onto the tableau
    for (const p of CELLS) {
      const t = topOf(state.piles, p);
      if (!t) continue;
      const to = TABLEAU.find((d) => (state.piles[d]?.length ?? 0) > 0 && this.canDrop(state, [t], d, p));
      if (to) return move(p, 0, to);
    }
    // 3. build between columns
    for (const p of TABLEAU) {
      const cards = state.piles[p] ?? [];
      for (let i = 0; i < cards.length; i++) {
        if (!this.canGrab(state, p, i)) continue;
        const run = cards.slice(i);
        const to = TABLEAU.find((d) => (state.piles[d]?.length ?? 0) > 0 && this.canDrop(state, run, d, p));
        if (to) return move(p, i, to);
        break;
      }
    }
    // 4. park somewhere — an empty column first, a cell as the last resort
    for (const p of TABLEAU) {
      const cards = state.piles[p] ?? [];
      if (cards.length < 2) continue;
      const to = TABLEAU.find((d) => (state.piles[d]?.length ?? 0) === 0);
      if (to && this.canDrop(state, [cards[cards.length - 1]!], to, p)) {
        return move(p, cards.length - 1, to);
      }
    }
    for (const p of TABLEAU) {
      if (!topOf(state.piles, p)) continue;
      const cell = CELLS.find((d) => (state.piles[d]?.length ?? 0) === 0);
      if (cell) return move(p, state.piles[p]!.length - 1, cell);
    }
    return null;
  },

  stat: (state) => ({
    label: 'תאים פנויים',
    value: `${CELLS.filter((p) => (state.piles[p]?.length ?? 0) === 0).length}/4`,
  }),

  par: () => ({ moves: 110, time: 420 }),
};

export const freecell = createCardGame(freecellSpec);
export { TABLEAU as FREECELL_TABLEAU, FOUNDATIONS as FREECELL_FOUNDATIONS, CELLS as FREECELL_CELLS };
