import { createRng } from '../../core/rng';

/**
 * 2048 rules, kept pure so they can be unit-tested and so the state stays
 * JSON-serialisable for undo and resume.
 *
 * Tiles carry an id so the view can slide the same tile rather than redraw the
 * grid, and spawns come from (seed, spawnCount) so undo replays identically
 * instead of rolling fresh dice.
 */

export const SIZE = 4;
export const CELLS = SIZE * SIZE;
export const TARGET = 2048;

export interface Tile {
  id: number;
  value: number;
  /** 0..15 */
  at: number;
  /** set on the frame a tile appears or doubles, for the pop animation */
  born?: boolean;
  merged?: boolean;
}

export interface G2048State {
  tiles: Tile[];
  seed: number;
  spawns: number;
  nextId: number;
  /**
   * Accumulated merge values — 2048's real score. It lives in state, so
   * `score(state)` stays a pure function of state and undo restores it. The
   * invariant was never "derivable from the tiles"; it is "not a side effect
   * the game writes whenever it likes".
   */
  merged: number;
  reached: boolean;
  keepGoing: boolean;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const rowOf = (i: number): number => Math.floor(i / SIZE);
const colOf = (i: number): number => i % SIZE;

/** Cell indices in the order they should be collapsed for a direction. */
function lines(dir: Direction): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < SIZE; k++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') line.push(k * SIZE + j);
      else if (dir === 'right') line.push(k * SIZE + (SIZE - 1 - j));
      else if (dir === 'up') line.push(j * SIZE + k);
      else line.push((SIZE - 1 - j) * SIZE + k);
    }
    out.push(line);
  }
  return out;
}

export interface MoveResult {
  readonly moved: boolean;
  readonly gained: number;
}

/** Slide and merge in place. Returns whether anything actually moved. */
export function slide(state: G2048State, dir: Direction): MoveResult {
  const byCell = new Map<number, Tile>();
  for (const t of state.tiles) byCell.set(t.at, t);

  let moved = false;
  let gained = 0;
  const survivors: Tile[] = [];

  for (const line of lines(dir)) {
    const present = line.map((i) => byCell.get(i)).filter((t): t is Tile => t !== undefined);
    let write = 0;

    for (let k = 0; k < present.length; k++) {
      const tile = present[k]!;
      const next = present[k + 1];

      tile.born = false;
      tile.merged = false;

      if (next && next.value === tile.value) {
        // merge: the absorbed tile slides onto this one and disappears
        const target = line[write]!;
        if (tile.at !== target) moved = true;
        tile.at = target;
        tile.value *= 2;
        tile.merged = true;
        gained += tile.value;
        next.at = target;                 // slide in, then drop from the board
        survivors.push(tile);
        k++;                              // consume the absorbed tile
        write++;
        moved = true;
      } else {
        const target = line[write]!;
        if (tile.at !== target) moved = true;
        tile.at = target;
        survivors.push(tile);
        write++;
      }
    }
  }

  state.tiles = survivors;
  state.merged += gained;
  return { moved, gained };
}

/** Deterministic spawn: same seed and spawn count give the same tile. */
export function spawn(state: G2048State): void {
  const occupied = new Set(state.tiles.map((t) => t.at));
  const free: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!occupied.has(i)) free.push(i);
  if (free.length === 0) return;

  const rng = createRng(state.seed + state.spawns * 0x9e3779b1);
  const at = free[rng.int(free.length)]!;
  const value = rng.next() < 0.9 ? 2 : 4;

  state.tiles.push({ id: state.nextId++, value, at, born: true });
  state.spawns++;
}

export function canMove(state: G2048State): boolean {
  if (state.tiles.length < CELLS) return true;
  const byCell = new Map<number, Tile>();
  for (const t of state.tiles) byCell.set(t.at, t);

  for (let i = 0; i < CELLS; i++) {
    const tile = byCell.get(i);
    if (!tile) return true;
    const right = colOf(i) < SIZE - 1 ? byCell.get(i + 1) : undefined;
    const down = rowOf(i) < SIZE - 1 ? byCell.get(i + SIZE) : undefined;
    if (right && right.value === tile.value) return true;
    if (down && down.value === tile.value) return true;
  }
  return false;
}

export const maxTile = (state: G2048State): number =>
  state.tiles.reduce((m, t) => Math.max(m, t.value), 0);

export function createState(seed: number): G2048State {
  const state: G2048State = {
    tiles: [], seed, spawns: 0, nextId: 1, merged: 0, reached: false, keepGoing: false,
  };
  spawn(state);
  spawn(state);
  return state;
}
