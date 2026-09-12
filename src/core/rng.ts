import type { Rng } from './types';

/**
 * Seeded PRNG (mulberry32). Every deal is reproducible from its seed, which
 * turns "a generated board failed once" from a heisenbug into a test case.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);

  return {
    next,
    int,
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const a0 = items[i]!;
        items[i] = items[j]!;
        items[j] = a0;
      }
      return items;
    },
  };
}

export const randomSeed = (): number => (Math.random() * 0xffffffff) >>> 0;
