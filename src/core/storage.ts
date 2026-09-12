import type { SettingsLike } from './types';
import type { SavedRound } from './engine';

/**
 * Every localStorage access lives here. It can throw or come back empty
 * (private windows, cleared site data), so every read has a fallback and
 * every write is allowed to fail silently — never at the cost of the game.
 */

const PREFIX = 'katav';
const keys = {
  settings: `${PREFIX}.settings`,
  save: (gameId: string) => `${PREFIX}.save.${gameId}`,
  best: (key: string) => `${PREFIX}.best.${key}`,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the game keeps working, it just won't remember */
  }
}

function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export const DEFAULT_SETTINGS: SettingsLike = {
  marks: false,   // target highlighting off by default
  size: 1,
  rtl: true,
  sound: true,
};

export const loadSettings = (): SettingsLike => ({
  ...DEFAULT_SETTINGS,
  ...read<Partial<SettingsLike>>(keys.settings, {}),
});

export const saveSettings = (s: SettingsLike): void => write(keys.settings, s);

export const readBest = (key: string): number => read<number>(keys.best(key), 0);
export const writeBest = (key: string, value: number): void => write(keys.best(key), value);

export const loadRound = (gameId: string): SavedRound | null =>
  read<SavedRound | null>(keys.save(gameId), null);

export const saveRound = (gameId: string, round: SavedRound | null): void => {
  if (round === null) remove(keys.save(gameId));
  else write(keys.save(gameId), round);
};
