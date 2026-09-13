import { expect, it } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { RANK_LABEL, type Card, type PileId, type Rank, type Suit } from '../../../src/games/cards/deck';
import { createCardGame, hiddenCount, type CardSpec, type CardState } from '../../../src/games/cards/model';
import { attemptMove } from '../../../src/games/cards/moves';
import { createHarness, checkRound, type Harness, type RoundExpectation } from './harness';

/**
 * A card position written out in full.
 *
 *   { t0: 'KS QH ?7D', f1: 'AH 2H' }
 *
 * Rank then suit — S♠ H♥ D♦ C♣ — with `?` for a card that is still face down.
 * Any pile left out of the literal must be empty, so a state B says everything
 * about the board rather than only the part a scenario was thinking about.
 */
export type Board = Readonly<Record<PileId, string>>;

const SUIT_LETTER = ['S', 'H', 'D', 'C'] as const;

/** 'AS 2S 3S …' — for the long literals a nearly-finished board needs. */
export function suitRun(
  suit: (typeof SUIT_LETTER)[number], from: number, to: number,
): string {
  const step = from <= to ? 1 : -1;
  const out: string[] = [];
  for (let r = from; r !== to + step; r += step) out.push(`${RANK_LABEL[r]}${suit}`);
  return out.join(' ');
}

function parseCard(token: string, id: number): Card {
  const down = token.startsWith('?');
  const body = down ? token.slice(1) : token;
  const suit = SUIT_LETTER.indexOf(body.slice(-1) as (typeof SUIT_LETTER)[number]);
  const rank = RANK_LABEL.indexOf(body.slice(0, -1) as (typeof RANK_LABEL)[number]);
  if (suit < 0 || rank < 1) throw new Error(`not a card: "${token}"`);
  return { id, rank: rank as Rank, suit: suit as Suit, up: !down };
}

const cardToken = (c: Card): string =>
  `${c.up ? '' : '?'}${RANK_LABEL[c.rank]}${SUIT_LETTER[c.suit]}`;

const pilesOf = (spec: CardSpec, state: CardState): PileId[] => {
  const l = spec.layoutOf(state);
  return [...l.top.map((t) => t.pile), ...l.tableau];
};

/** Build a real state from the literal, using the game's own pile set. */
export function buildBoard(spec: CardSpec, difficulty: string | undefined, board: Board): CardState {
  const state = spec.deal(createRng(1), difficulty);
  for (const key of Object.keys(state.piles)) state.piles[key] = [];

  let id = 0;
  for (const [pile, text] of Object.entries(board)) {
    if (state.piles[pile] === undefined) throw new Error(`no such pile: "${pile}"`);
    state.piles[pile] = text.split(/\s+/).filter(Boolean).map((t) => parseCard(t, id++));
  }

  // Face-down cards in a hand-built position count as already dealt, so the
  // "cards revealed" part of the score measures what this scenario turns over.
  state.hidden0 = hiddenCount(state, spec.layoutOf(state).tableau);
  return state;
}

export function renderBoard(spec: CardSpec, state: CardState): Record<PileId, string> {
  const out: Record<PileId, string> = {};
  for (const pile of pilesOf(spec, state)) {
    out[pile] = (state.piles[pile] ?? []).map(cardToken).join(' ');
  }
  return out;
}

/** Compare against the literal, treating every unmentioned pile as empty. */
export function expectBoard(spec: CardSpec, state: CardState, expected: Board): void {
  const full: Record<PileId, string> = {};
  for (const pile of pilesOf(spec, state)) full[pile] = '';
  for (const [pile, text] of Object.entries(expected)) {
    if (full[pile] === undefined) throw new Error(`no such pile: "${pile}"`);
    full[pile] = text.split(/\s+/).filter(Boolean).join(' ');
  }
  expect(renderBoard(spec, state)).toEqual(full);
}

/* ---- the runner --------------------------------------------------------- */

export interface CardHarness extends Harness<CardState> {
  /** offer a run to a pile, exactly as dropping it there does */
  readonly try: (from: PileId, index: number, to: PileId) => boolean;
  /** tap the stock: Klondike's draw, Spider's deal */
  readonly stock: () => boolean;
  readonly board: () => Record<PileId, string>;
}

export interface CardScenario extends RoundExpectation {
  readonly name: string;
  /** state A */
  readonly given: Board;
  /** the action */
  readonly when: (h: CardHarness) => void;
  /** state B */
  readonly then: Board;
}

export function cardHarness(
  spec: CardSpec, difficulty: string | undefined, board: Board,
): CardHarness {
  const def = createCardGame(spec);
  const base = createHarness(def, {
    ...(difficulty !== undefined ? { difficulty } : {}),
    state: buildBoard(spec, difficulty, board),
  });
  return Object.assign(base, {
    try: (from: PileId, index: number, to: PileId) =>
      attemptMove(base.session, spec, from, index, to),
    stock: () => spec.onStock?.(base.session.state, base.session) ?? false,
    board: () => renderBoard(spec, base.session.state),
  });
}

export function runCardScenarios(
  spec: CardSpec, difficulty: string | undefined, scenarios: readonly CardScenario[],
): void {
  for (const s of scenarios) {
    it(s.name, () => {
      const h = cardHarness(spec, difficulty, s.given);
      // A position that does not survive being written down and read back would
      // make every later assertion meaningless.
      expectBoard(spec, h.state, s.given);
      h.clear();

      s.when(h);

      expectBoard(spec, h.state, s.then);
      checkRound(h, s);
    });
  }
}
