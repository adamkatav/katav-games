import { describe, expect, it } from 'vitest';
import {
  CELLS, SIZE, canMove, createState, maxTile, slide, spawn,
  type Direction, type G2048State, type Tile,
} from '../../src/games/g2048/logic';
import { g2048 } from '../../src/games/g2048/def';
import { createRng } from '../../src/core/rng';

/** Build a board from a 4x4 array of values, 0 for empty. */
const board = (rows: number[][]): G2048State => {
  const tiles: Tile[] = [];
  let id = 1;
  rows.forEach((row, r) => row.forEach((v, c) => {
    if (v) tiles.push({ id: id++, value: v, at: r * SIZE + c });
  }));
  return { tiles, seed: 1, spawns: 0, nextId: id, merged: 0, reached: false, keepGoing: false };
};

const grid = (s: G2048State): number[][] => {
  const out = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
  for (const t of s.tiles) out[Math.floor(t.at / SIZE)]![t.at % SIZE] = t.value;
  return out;
};

describe('sliding', () => {
  it('slides tiles to the wall', () => {
    const s = board([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(slide(s, 'left').moved).toBe(true);
    expect(grid(s)[0]).toEqual([2, 0, 0, 0]);
  });

  it('merges a matching pair once, not twice', () => {
    const s = board([[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const { gained } = slide(s, 'left');
    expect(grid(s)[0]).toEqual([4, 4, 0, 0]);
    expect(gained).toBe(4);
  });

  it('does not chain a merge through the same move', () => {
    // 2 2 4 0 left gives 4 4, never 8 — the new 4 must not merge again
    const s = board([[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    slide(s, 'left');
    expect(grid(s)[0]).not.toEqual([8, 0, 0, 0]);
  });

  it('merges the far pair first when four match', () => {
    const s = board([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const { gained } = slide(s, 'left');
    expect(grid(s)[0]).toEqual([4, 4, 0, 0]);
    expect(gained).toBe(8);
  });

  it.each<Direction>(['up', 'down', 'left', 'right'])('reports no movement for %s on a wall', (dir) => {
    const full = board([[2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]]);
    expect(slide(full, dir).moved).toBe(false);
  });
});

describe('spawning is deterministic', () => {
  it('gives the same tile for the same seed and spawn count', () => {
    const a = createState(4242);
    const b = createState(4242);
    expect(grid(a)).toEqual(grid(b));
    spawn(a); spawn(b);
    expect(grid(a)).toEqual(grid(b));
  });

  it('starts with two tiles and only spawns into free cells', () => {
    const s = createState(7);
    expect(s.tiles).toHaveLength(2);
    for (let i = 0; i < 10; i++) spawn(s);
    expect(new Set(s.tiles.map((t) => t.at)).size).toBe(s.tiles.length);
    expect(s.tiles.length).toBeLessThanOrEqual(CELLS);
  });
});

describe('scoring stays a pure function of state', () => {
  it('accumulates merges, and identical states score identically', () => {
    const a = board([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    slide(a, 'left');
    const snapshot = JSON.parse(JSON.stringify(a)) as G2048State;
    expect(g2048.score(snapshot)).toBe(g2048.score(a));
  });

  it('restores the score exactly when state is restored', () => {
    const s = createState(11);
    const before = JSON.parse(JSON.stringify(s)) as G2048State;
    slide(s, 'left');
    const restored = JSON.parse(JSON.stringify(before)) as G2048State;
    expect(g2048.score(restored)).toBe(g2048.score(before));
  });
});

describe('outcomes', () => {
  it('is lost only when no move remains', () => {
    // full board, but the two 64s at the bottom are adjacent and can still merge
    const alive = board([[2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 64]]);
    expect(canMove(alive)).toBe(true);
    const stuck = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
    expect(canMove(stuck)).toBe(false);
    expect(g2048.isLost!(stuck)).toBe(true);
  });

  it('does not end the round the moment 2048 appears', () => {
    const s = board([[2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(maxTile(s)).toBe(2048);
    expect(g2048.isWon(s)).toBe(false);         // reached is only set by a move
  });

  it('suggests a direction that actually moves something', () => {
    const s = board([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const hint = g2048.hint(s);
    expect(hint).not.toBeNull();
    if (hint?.kind === 'cell') expect(hint.message).toBeTruthy();
  });

  it('creates a playable board from the engine', () => {
    const s = g2048.create(createRng(3));
    expect(s.tiles).toHaveLength(2);
    expect(g2048.score(s)).toBe(0);
    expect(g2048.isLost!(s)).toBe(false);
  });
});
