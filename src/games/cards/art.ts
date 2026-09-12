import { RANK_LABEL, SUIT_GLYPH, isRed, type Card, type Rank } from './deck';

import kingUrl from '../../../art/king.png';
import queenUrl from '../../../art/queen.png';
import jackUrl from '../../../art/jack.png';
import backUrl from '../../../art/back.png';
import crestUrl from '../../../art/crest.png';

export const CREST_URL = crestUrl;
export const BACK_URL = backUrl;

const INK = '#151515';
const RED = '#c8102e';

/** One court figure per rank, shared across all four suits — as in a real deck,
 *  where only the corner index and the pip change colour. */
const COURT: Record<number, string> = { 11: jackUrl, 12: queenUrl, 13: kingUrl };

/** Classic pip arrangements: [column 0=left 1=centre 2=right, vertical 0..1]. */
const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  2: [[1, 0], [1, 1]],
  3: [[1, 0], [1, 0.5], [1, 1]],
  4: [[0, 0], [2, 0], [0, 1], [2, 1]],
  5: [[0, 0], [2, 0], [1, 0.5], [0, 1], [2, 1]],
  6: [[0, 0], [2, 0], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
  7: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
  8: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [1, 0.75], [0, 1], [2, 1]],
  9: [[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, 0.5], [0, 2 / 3], [2, 2 / 3], [0, 1], [2, 1]],
  10: [[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3], [2, 2 / 3], [1, 5 / 6], [0, 1], [2, 1]],
};

const PIP_X = [34, 50, 66] as const;
const PIP_Y0 = 37, PIP_SPAN = 71;

/** The whole face as one SVG on a 100x145 viewBox, so it scales with the card. */
export function faceSvg(card: Card): string {
  const colour = isRed(card) ? RED : INK;
  const glyph = SUIT_GLYPH[card.suit];
  const label = RANK_LABEL[card.rank];

  // A large index in both top corners stays readable whichever way a column fans.
  const index = (x: number) =>
    `<text x="${x}" y="30" font-size="27" font-weight="bold" text-anchor="middle" fill="${colour}">${label}</text>` +
    `<text x="${x}" y="50" font-size="21" text-anchor="middle" fill="${colour}">${glyph}</text>`;

  let middle: string;
  if (card.rank >= 11) {
    middle = `<image href="${COURT[card.rank]}" x="6" y="50" width="88" height="92" preserveAspectRatio="xMidYMax meet"/>`;
  } else if (card.rank === 1) {
    middle = `<text x="50" y="78" font-size="56" text-anchor="middle" dominant-baseline="central" fill="${colour}">${glyph}</text>`;
  } else {
    middle = (PIPS[card.rank] ?? []).map(([col, f]) => {
      const x = PIP_X[col]!, y = PIP_Y0 + f * PIP_SPAN;
      const rotate = f > 0.5 ? ` transform="rotate(180 ${x} ${y})"` : '';
      return `<text x="${x}" y="${y}" font-size="23" text-anchor="middle" dominant-baseline="central" fill="${colour}"${rotate}>${glyph}</text>`;
    }).join('');
  }

  return `<svg viewBox="0 0 100 145" xmlns="http://www.w3.org/2000/svg" ` +
    `font-family="Georgia,'Times New Roman',serif">${index(15)}${index(85)}${middle}</svg>`;
}

export const rankLabel = (r: Rank): string => RANK_LABEL[r]!;
