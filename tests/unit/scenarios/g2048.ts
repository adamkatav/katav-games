import { expect, it } from 'vitest';
import { g2048, performMove } from '../../../src/games/g2048/def';
import { CELLS, SIZE, type Direction, type G2048State, type Tile } from '../../../src/games/g2048/logic';
import { createHarness, checkRound, type Harness, type RoundExpectation } from './harness';

/**
 * A 2048 board written as four rows.
 *
 *   ['2 2 . .', '4 . . .', '. . . .', '. . . .']
 *
 * Every move drops a new tile somewhere, which would make a literal state B
 * hostage to the spawn. So the picture compared after a move is the board
 * *without* the tile that was just born, and the spawn is asserted separately:
 * exactly one, of 2 or 4, on a square that was free. Nothing is hidden by it —
 * a move that spawns twice, or spawns on top of something, fails.
 */

export type Picture = readonly string[];

export function buildG2048(picture: Picture, options: { seed?: number; merged?: number } = {}): G2048State {
  if (picture.length !== SIZE) throw new Error('a board is four rows');
  const tiles: Tile[] = [];
  let id = 1;

  picture.forEach((row, r) => {
    const cells = row.split(/\s+/).filter(Boolean);
    if (cells.length !== SIZE) throw new Error(`not four columns: "${row}"`);
    cells.forEach((cell, c) => {
      if (cell === '.') return;
      const value = Number(cell);
      if (!Number.isInteger(value) || value < 2) throw new Error(`not a tile: "${cell}"`);
      tiles.push({ id: id++, value, at: r * SIZE + c });
    });
  });

  return {
    tiles,
    seed: options.seed ?? 12345,
    spawns: 0,
    nextId: id,
    merged: options.merged ?? 0,
    reached: tiles.some((t) => t.value >= 2048),
    keepGoing: false,
  };
}

/** The board as it stands, optionally ignoring the tile that was just born. */
export function renderG2048(s: G2048State, options: { hideBorn?: boolean } = {}): string[] {
  const cells = new Array<string>(CELLS).fill('.');
  for (const tile of s.tiles) {
    if (options.hideBorn && tile.born) continue;
    cells[tile.at] = String(tile.value);
  }
  return Array.from({ length: SIZE }, (_, r) => cells.slice(r * SIZE, r * SIZE + SIZE).join(' '));
}

/* ---- the runner --------------------------------------------------------- */

export interface G2048Harness extends Harness<G2048State> {
  /** press an arrow — the same call the buttons, the keys and a swipe all make */
  readonly push: (dir: Direction) => boolean;
  readonly picture: (options?: { hideBorn?: boolean }) => string[];
}

export interface G2048Scenario extends RoundExpectation {
  readonly name: string;
  /** state A */
  readonly given: Picture;
  readonly when: (h: G2048Harness) => void;
  /** state B, without the tile that spawned */
  readonly then: Picture;
  /** how many tiles should have been born; defaults to one */
  readonly spawned?: number;
  readonly seed?: number;
  /** the accumulated score the position starts with */
  readonly startingScore?: number;
}

export function g2048Harness(picture: Picture, options: { seed?: number; merged?: number } = {}): G2048Harness {
  const base = createHarness(g2048, { state: buildG2048(picture, options) });
  return Object.assign(base, {
    push: (dir: Direction) => performMove(base.session, dir),
    picture: (opts: { hideBorn?: boolean } = {}) => renderG2048(base.state, opts),
  });
}

export function runG2048Scenarios(scenarios: readonly G2048Scenario[]): void {
  for (const s of scenarios) {
    it(s.name, () => {
      const h = g2048Harness(s.given, {
        ...(s.seed !== undefined ? { seed: s.seed } : {}),
        ...(s.startingScore !== undefined ? { merged: s.startingScore } : {}),
      });
      expect(h.picture(), 'the position must read back as it was written').toEqual([...s.given]);
      h.clear();

      s.when(h);

      expect(h.picture({ hideBorn: true })).toEqual([...s.then]);

      const born = h.state.tiles.filter((t) => t.born);
      const settled = new Set(h.state.tiles.filter((t) => !t.born).map((t) => t.at));
      expect(born, 'tiles born by this move').toHaveLength(s.spawned ?? 1);
      for (const tile of born) {
        expect([2, 4], 'a new tile is a 2 or a 4').toContain(tile.value);
        expect(settled.has(tile.at), 'a new tile landed on an occupied square').toBe(false);
      }
      expect(h.state.spawns, 'the spawn counter tracks the tiles born').toBe(s.spawned ?? 1);

      checkRound(h, s);
    });
  }
}
