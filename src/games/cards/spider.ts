import type { Difficulty, Hint, Rng, ViewHost } from '../../core/types';
import { buildDeck, ids, isSameSuitRun, topOf, type Suit, type PileId } from './deck';
import { createCardGame, hiddenCount, revealTop, type CardSpec, type CardState } from './model';

const TABLEAU = ids('t', 10);
const COMPLETED = ids('c', 8);

const SUITS_FOR: Record<string, readonly Suit[]> = {
  '1': [0],
  '2': [0, 1],
  '4': [0, 1, 2, 3],
};

const DIFFICULTIES: readonly Difficulty[] = [
  { id: '1', label: 'קל · צבע אחד', note: 'מומלץ להתחלה' },
  { id: '2', label: 'בינוני · שני צבעים' },
  { id: '4', label: 'קשה · ארבעה צבעים' },
];

/** Retire any completed King-to-Ace run. Returns how many sets left the board. */
export function collectSets(state: CardState): number {
  let collected = 0;
  for (const p of TABLEAU) {
    const cards = state.piles[p]!;
    if (cards.length < 13) continue;
    const run = cards.slice(-13);
    if (run[0]!.rank !== 13 || !run.every((c) => c.up) || !isSameSuitRun(run)) continue;
    const slot = COMPLETED.find((c) => (state.piles[c]?.length ?? 0) === 0);
    if (!slot) continue;
    cards.splice(cards.length - 13, 13);
    state.piles[slot]!.push(...run);
    revealTop(state.piles, p);
    collected++;
  }
  return collected;
}

export const spiderSpec: CardSpec = {
  id: 'spider',
  name: 'סוליטר עכביש',
  emoji: '🕷️',
  blurb: 'לסדר סדרות ממלך עד אס',
  difficulties: DIFFICULTIES,

  deal(rng: Rng, difficulty = '1'): CardState {
    const suits = SUITS_FOR[difficulty] ?? SUITS_FOR['1']!;
    const deck = rng.shuffle(buildDeck(suits, 8 / suits.length));

    const piles: CardState['piles'] = { stock: [] };
    for (const p of COMPLETED) piles[p] = [];
    for (const p of TABLEAU) piles[p] = [];

    TABLEAU.forEach((pile, c) => {
      const n = c < 4 ? 6 : 5;
      for (let k = 0; k < n; k++) {
        const card = deck.pop()!;
        card.up = k === n - 1;
        piles[pile]!.push(card);
      }
    });
    piles['stock'] = deck;

    const state: CardState = { piles, hidden0: 0 };
    state.hidden0 = hiddenCount(state, TABLEAU);
    return state;
  },

  layoutOf: () => ({
    columns: 10,
    top: [
      { pile: 'stock', col: 0 },
      ...COMPLETED.map((pile, i) => ({ pile, col: 2 + i })),
    ],
    tableau: TABLEAU,
    stacked: ['stock', ...COMPLETED],
  }),

  canGrab(state, pile, index) {
    const cards = state.piles[pile];
    if (!cards || index < 0 || index >= cards.length) return false;
    if (pile === 'stock' || COMPLETED.includes(pile)) return false;
    const run = cards.slice(index);
    return run.every((c) => c.up) && isSameSuitRun(run);
  },

  canDrop(state, run, dest, from) {
    if (dest === from || dest === 'stock' || COMPLETED.includes(dest)) return false;
    const card = run[0];
    if (!card) return false;
    const t = topOf(state.piles, dest);
    if (!t) return true;                    // any card may open an empty column
    return t.up && t.rank === card.rank + 1;
  },

  whyNot(state, _run, dest) {
    if (dest === 'stock') return 'אי אפשר להניח קלפים על החפיסה';
    if (COMPLETED.includes(dest)) return 'הערימות למעלה מתמלאות לבד כשמשלימים סדרה';
    const t = topOf(state.piles, dest);
    if (!t) return '';                      // legal, so there is nothing to explain
    if (!t.up) return 'צריך להפוך קודם את הקלף הזה';
    return 'צריך להניח על קלף גדול באחד';
  },

  onStock(state, host: ViewHost<CardState>) {
    if ((state.piles['stock']?.length ?? 0) === 0) {
      host.toast('אין יותר קלפים בחפיסה');
      host.sound.bad();
      return false;
    }
    // Standard Spider: no dealing while a column is empty. The view flashes the
    // offending columns, because naming the rule without showing them is useless.
    const empties = TABLEAU.filter((p) => (state.piles[p]?.length ?? 0) === 0);
    if (empties.length > 0) {
      host.toast(empties.length === 1
        ? 'אי אפשר לחלק כשיש טור ריק — צריך למלא אותו קודם'
        : 'אי אפשר לחלק כשיש טורים ריקים — צריך למלא אותם קודם');
      host.sound.bad();
      return false;
    }
    host.commit((draft) => {
      TABLEAU.forEach((pile, i) => {
        const card = draft.piles['stock']!.pop()!;
        card.up = true;
        draft.piles[pile]!.push(card);
        setTimeout(() => host.sound.deal(i), i * 45);
      });
      collectSets(draft);
    });
    return true;
  },

  afterMove(state, host) {
    for (const p of TABLEAU) revealTop(state.piles, p);
    if (collectSets(state) > 0) {
      host.sound.set();
      host.toast('סדרה הושלמה! 🎉');
    }
  },

  score(state) {
    const revealed = (state.hidden0 - hiddenCount(state, TABLEAU)) * 10;
    let pairs = 0;
    for (const p of TABLEAU) {
      const cards = state.piles[p] ?? [];
      for (let i = 1; i < cards.length; i++) {
        const a = cards[i - 1]!, b = cards[i]!;
        if (a.up && b.up && b.suit === a.suit && b.rank === a.rank - 1) pairs++;
      }
    }
    const sets = COMPLETED.filter((p) => (state.piles[p]?.length ?? 0) === 13).length;
    return revealed + pairs * 5 + sets * 150;
  },

  isWon: (state) => COMPLETED.every((p) => (state.piles[p]?.length ?? 0) === 13),

  hint(state): Hint | null {
    interface Candidate { from: PileId; index: number; to: PileId; score: number }
    const candidates: Candidate[] = [];

    for (const p of TABLEAU) {
      const cards = state.piles[p] ?? [];
      for (let i = 0; i < cards.length; i++) {
        if (!this.canGrab(state, p, i)) continue;
        const run = cards.slice(i);
        for (const d of TABLEAU) {
          if (!this.canDrop(state, run, d, p)) continue;
          const t = topOf(state.piles, d);
          let score = run.length;
          if (t && t.suit === run[0]!.suit) score += 50;     // same-suit join
          if (i > 0 && !cards[i - 1]!.up) score += 40;       // turns a card over
          if (i === 0 && cards.length === run.length) score -= 25;
          if (!t) score -= 10;                               // keep empties free
          candidates.push({ from: p, index: i, to: d, score });
        }
        break;
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0]!;
      if (best.score > 0) return { kind: 'move', from: best.from, index: best.index, to: best.to };
    }

    const canDeal =
      (state.piles['stock']?.length ?? 0) > 0 &&
      TABLEAU.every((p) => (state.piles[p]?.length ?? 0) > 0);
    if (canDeal) return { kind: 'pile', pile: 'stock', message: 'אפשר לחלק סיבוב חדש' };

    const fallback = candidates[0];
    return fallback
      ? { kind: 'move', from: fallback.from, index: fallback.index, to: fallback.to }
      : null;
  },

  stat: (state) => ({
    label: 'סדרות',
    value: `${COMPLETED.filter((p) => (state.piles[p]?.length ?? 0) === 13).length}/8`,
  }),

  par: (difficulty = '1') =>
    difficulty === '4' ? { moves: 380, time: 1200 }
    : difficulty === '2' ? { moves: 260, time: 900 }
    : { moves: 160, time: 600 },
};

export const spider = createCardGame(spiderSpec);
export { TABLEAU as SPIDER_TABLEAU, COMPLETED as SPIDER_COMPLETED };
