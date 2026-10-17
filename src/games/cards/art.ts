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

/**
 * The whole face as one SVG on a 100x145 viewBox, so it scales with the card.
 *
 * Drawn for reading, not for tradition: one big rank and its suit across the
 * top, then a single large suit (or the court figure) filling the rest. Pip
 * patterns made a 7 a field of small symbols to count; this player reads the
 * number instead. The index sits in the top strip that stays visible when a
 * column fans, so FAN_UP_MIN in layout.ts has to keep clearing it.
 */
export function faceSvg(card: Card): string {
  const colour = isRed(card) ? RED : INK;
  const glyph = SUIT_GLYPH[card.suit];
  const label = RANK_LABEL[card.rank];

  // The rank goes on the side that stays uncovered when cards fan sideways
  // (the Klondike waste), which flips with reading direction. Both layouts are
  // drawn and the stylesheet shows one, so a direction change needs no redraw.
  const rank = (x: number, anchor: string) =>
    `<text x="${x}" y="${INDEX_BASELINE}" font-size="68" font-weight="bold" text-anchor="${anchor}" fill="${colour}"` +
    `${label.length > 1 ? ' textLength="68" lengthAdjust="spacingAndGlyphs"' : ''}>${label}</text>`;
  const suit = (x: number, anchor: string) =>
    `<text x="${x}" y="${INDEX_BASELINE}" font-size="36" text-anchor="${anchor}" fill="${colour}">${glyph}</text>`;
  const index =
    `<g class="idx-ltr">${rank(3, 'start')}${suit(97, 'end')}</g>` +
    `<g class="idx-rtl">${rank(97, 'end')}${suit(3, 'start')}</g>`;

  const middle = card.rank >= 11
    ? `<image href="${COURT[card.rank]}" x="8" y="64" width="84" height="78" preserveAspectRatio="xMidYMax meet"/>`
    : `<text x="50" y="104" font-size="70" text-anchor="middle" dominant-baseline="central" fill="${colour}">${glyph}</text>`;

  return `<svg viewBox="0 0 100 145" xmlns="http://www.w3.org/2000/svg" ` +
    `font-family="Arial,Helvetica,sans-serif">${index}${middle}</svg>`;
}

/** Where the index text sits: its capitals run from about y=5 to here. */
const INDEX_BASELINE = 54;

export const rankLabel = (r: Rank): string => RANK_LABEL[r]!;
