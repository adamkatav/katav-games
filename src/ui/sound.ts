import type { SettingsLike, SoundLike } from '../core/types';

/**
 * Every sound is synthesised here. No audio files, ever — that is what keeps
 * the app small and working offline. Pitch carries meaning: the streak
 * arpeggio climbs with the multiplier and falls when it breaks, so a player
 * can hear how it is going without looking.
 */
export function createSound(settings: SettingsLike): SoundLike & { resume(): void } {
  let ctx: AudioContext | null = null;

  const audio = (): AudioContext | null => {
    if (!ctx) {
      try { ctx = new AudioContext(); } catch { return null; }
    }
    return ctx;
  };

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    if (!settings.sound) return;
    const c = audio();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    resume() { void audio()?.resume(); },

    select: () => tone(620, 0.05, 'sine', 0.08),
    place: () => { tone(520, 0.09, 'triangle', 0.16); tone(760, 0.07, 'triangle', 0.10, 0.03); },
    flip: () => tone(330, 0.07, 'square', 0.07),
    deal: (i) => tone(400 + (i % 5) * 40, 0.05, 'triangle', 0.06),
    found: () => { tone(660, 0.1, 'sine', 0.17); tone(880, 0.13, 'sine', 0.15, 0.07); },
    set: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.18, i * 0.08)),
    bad: () => tone(150, 0.13, 'sawtooth', 0.07),

    combo: (level) => {
      const base = 392 * Math.pow(1.122, Math.min(level, 9));
      [0, 4, 7, 12].forEach((s, i) => tone(base * Math.pow(2, s / 12), 0.2, 'triangle', 0.15, i * 0.055));
    },
    comboEnd: () => { tone(330, 0.18, 'sawtooth', 0.10); tone(196, 0.26, 'sawtooth', 0.10, 0.11); },

    space: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.55, 'sine', 0.17, i * 0.075));
      tone(1568, 0.7, 'sine', 0.09, 0.3);
    },
    star: (i) => tone(700 + i * 130, 0.2, 'triangle', 0.16),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.45, 'triangle', 0.2, i * 0.13)),
  };
}
