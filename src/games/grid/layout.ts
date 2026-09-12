/**
 * Grid geometry, shared by every non-card game.
 *
 * Same discipline as the card layout: size from the viewport, never scroll by
 * default, and keep a legibility floor — a number the player cannot read is
 * worse than a smaller board.
 */

export interface GridGeometry {
  readonly cell: number;
  readonly gap: number;
  readonly width: number;
  readonly height: number;
  /** true when the board had to shrink below the comfortable size */
  readonly tight: boolean;
}

export interface GridLayoutInput {
  readonly cols: number;
  readonly rows: number;
  readonly availableW: number;
  readonly availableH: number;
  /** space to leave for game-owned controls: a number pad, arrow buttons */
  readonly reservedH: number;
  readonly sizeScale: number;
  /** below this a cell's label stops being readable at arm's length */
  readonly minCell?: number;
  readonly maxCell?: number;
  /** 0 makes the cells touch, for boards drawn with ruled lines rather than gaps */
  readonly gapRatio?: number;
}

export function computeGridGeometry(input: GridLayoutInput): GridGeometry {
  const { cols, rows } = input;
  const minCell = input.minCell ?? 26;
  const maxCell = input.maxCell ?? 120;

  const usableH = Math.max(0, input.availableH - input.reservedH);
  const gapRatio = input.gapRatio ?? (cols > 12 ? 0.05 : 0.08);

  const byWidth = input.availableW / (cols + (cols - 1) * gapRatio);
  const byHeight = usableH / (rows + (rows - 1) * gapRatio);

  let cell = Math.min(byWidth, byHeight) * input.sizeScale;
  const tight = cell < minCell;
  cell = Math.max(minCell, Math.min(maxCell, cell));

  const size = Math.floor(cell);
  const gap = gapRatio === 0 ? 0 : Math.max(2, Math.floor(size * gapRatio));

  return {
    cell: size,
    gap,
    width: cols * size + (cols - 1) * gap,
    height: rows * size + (rows - 1) * gap,
    tight,
  };
}

/** Top-left corner of a cell, in board coordinates. */
export function cellPosition(
  geometry: GridGeometry, cols: number, index: number, rtl: boolean,
): { x: number; y: number } {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const step = geometry.cell + geometry.gap;
  const x = rtl ? geometry.width - geometry.cell - col * step : col * step;
  return { x, y: row * step };
}

/** Which cell a point falls in, or null. */
export function cellAt(
  geometry: GridGeometry, cols: number, rows: number,
  px: number, py: number, rtl: boolean,
): number | null {
  const step = geometry.cell + geometry.gap;
  let col = Math.floor(px / step);
  const row = Math.floor(py / step);
  if (rtl) col = cols - 1 - col;
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  // ignore the gutters, so a near-miss does not act on a neighbour
  if (px % step > geometry.cell + geometry.gap / 2) return null;
  if (py % step > geometry.cell + geometry.gap / 2) return null;
  return row * cols + col;
}

export const neighbours = (
  index: number, cols: number, rows: number,
): number[] => {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const c = col + dx, r = row + dy;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      out.push(r * cols + c);
    }
  }
  return out;
};
