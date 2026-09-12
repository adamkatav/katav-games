import type { CardLayoutSpec, CardState } from './model';
import type { PileId } from './deck';

/**
 * Board geometry. Extracted so it can be unit-tested without a DOM, because
 * two of the nastiest bugs in this project lived here:
 *
 *  - the fan compressed until the rank at the top of a card was clipped;
 *  - a long column made the board scroll instead of the cards getting smaller.
 */

export interface Geometry {
  cardW: number;
  cardH: number;
  gap: number;
  boardW: number;
  boardH: number;
  /** pile id -> position and, for tableau piles, its fan offsets */
  piles: Record<PileId, { x: number; y: number; faceDown: number; faceUp: number }>;
}

export interface LayoutInput {
  readonly availableW: number;
  readonly availableH: number;
  readonly rtl: boolean;
  readonly sizeScale: number;
  /** monotonic within a round: tightens, never bounces back */
  readonly fanCap: number;
}

// ratios of card width
const FAN_DOWN = 0.22, FAN_DOWN_MIN = 0.10, FAN_DOWN_MAX = 0.40;
const FAN_UP = 0.48, FAN_UP_MIN = 0.34, FAN_UP_MAX = 0.80;
const CARD_RATIO = 1.45;   // height / width

/** The height a column needs, as a multiple of card width, at tightest legible fan. */
export function requiredRatio(
  state: CardState, spec: CardLayoutSpec, gapRatio: number,
): number {
  const top = CARD_RATIO + gapRatio * 1.7;
  let deepest = 0;
  for (const p of spec.tableau) {
    const pile = state.piles[p] ?? [];
    const down = pile.filter((c) => !c.up).length;
    const up = Math.max(0, pile.length - down - 1);
    deepest = Math.max(deepest, FAN_DOWN_MIN * down + FAN_UP_MIN * up);
  }
  return top + deepest + CARD_RATIO;
}

export function computeGeometry(
  state: CardState, spec: CardLayoutSpec, input: LayoutInput,
): Geometry {
  const cols = spec.columns;
  const gapRatio = cols >= 10 && input.availableW < 680 ? 0.05 : 0.12;

  const byWidth = input.availableW / (cols + (cols - 1) * gapRatio);
  const byHeight = input.availableH / 3.55 / CARD_RATIO;
  // The fan cap is what stops a long column from scrolling the board: bounding
  // card width by the height the deepest column needs shrinks the cards instead.
  const byDepth = input.availableH / input.fanCap;

  let cw = Math.min(byWidth, byHeight, byDepth) * input.sizeScale;
  cw = Math.max(32, Math.min(190, cw));

  const cardW = Math.floor(cw);
  const cardH = Math.round(cardW * CARD_RATIO);
  const gap = Math.floor(cardW * gapRatio);
  const boardW = cols * cardW + (cols - 1) * gap;

  const colX = (c: number) => c * (cardW + gap);
  const x = (v: number) => (input.rtl ? boardW - cardW - v : v);
  const tableauY = cardH + Math.round(gap * 1.7);

  const piles: Geometry['piles'] = {};
  for (const { pile, col } of spec.top) {
    piles[pile] = { x: x(colX(col)), y: 0, faceDown: 0, faceUp: 0 };
  }

  // Expand the fan into spare height rather than stranding the board at the top,
  // but size it from a typical worst case so spacing does not shift every move.
  // The slack matters: compression stops the moment the column fits exactly, and
  // without it the rounding below pushes the board one pixel into scrolling.
  const room = input.availableH - tableauY - 4;
  const typical = cols >= 10 ? { down: 5, up: 9 } : { down: 6, up: 7 };
  const need = (typical.down * FAN_DOWN + typical.up * FAN_UP + CARD_RATIO) * cardW;
  let grow = 1;
  if (need > cardH && need < room) {
    grow = Math.min(
      (room - cardH) / (need - cardH),
      FAN_UP_MAX / FAN_UP,
      FAN_DOWN_MAX / FAN_DOWN,
    );
  }

  let bottom = tableauY + cardH;
  spec.tableau.forEach((pile, c) => {
    const cards = state.piles[pile] ?? [];
    const down = cards.filter((cd) => !cd.up).length;
    const up = Math.max(0, cards.length - down - 1);

    let fd = FAN_DOWN * cardW * grow;
    let fu = FAN_UP * cardW * grow;
    let height = down * fd + up * fu + cardH;

    // Squeeze the face-down slivers first; only then the face-up cards, and
    // never past the point where the rank in the corner stops being readable.
    if (height > room && down > 0) {
      const cut = Math.min(height - room, down * (fd - FAN_DOWN_MIN * cardW));
      fd -= cut / down; height -= cut;
    }
    if (height > room && up > 0) {
      const cut = Math.min(height - room, up * (fu - FAN_UP_MIN * cardW));
      fu -= cut / up; height -= cut;
    }

    piles[pile] = { x: x(colX(c)), y: tableauY, faceDown: fd, faceUp: fu };
    bottom = Math.max(bottom, tableauY + down * fd + up * fu + cardH);
  });

  return { cardW, cardH, gap, boardW, boardH: Math.ceil(bottom), piles };
}

/** Position of the card at `index` within a pile. */
export function cardPosition(
  geometry: Geometry, state: CardState, pile: PileId, index: number,
): { x: number; y: number } {
  const g = geometry.piles[pile];
  const cards = state.piles[pile];
  if (!g || !cards) return { x: 0, y: 0 };
  if (g.faceDown === 0 && g.faceUp === 0) return { x: g.x, y: g.y };

  let y = g.y;
  const n = Math.min(index, cards.length);
  for (let i = 0; i < n; i++) y += cards[i]!.up ? g.faceUp : g.faceDown;
  return { x: g.x, y };
}
