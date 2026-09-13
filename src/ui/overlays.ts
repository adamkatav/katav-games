import type { Difficulty } from '../core/types';
import type { RoundSummary } from '../core/engine';
import { button, clear, confetti, h } from './dom';
import { T } from './i18n';

let layer: HTMLElement | null = null;

function open(panel: HTMLElement, dismissable = true): () => void {
  close();
  const overlay = h('div', { class: 'overlay' }, panel);
  if (dismissable) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }
  document.body.append(overlay);
  layer = overlay;
  return close;
}

export function close(): void {
  layer?.remove();
  layer = null;
}

export const isOpen = (): boolean => layer !== null;

export function confirmDialog(title: string, body: string, onYes: () => void): void {
  open(h('div', { class: 'panel' },
    h('h2', {}, title),
    h('p', {}, body),
    h('div', { class: 'row' },
      button(T.yes, '', () => { close(); onYes(); }, 'red'),
      button(T.noBack, '', close, 'ghost')),
  ));
}

export function difficultyDialog(
  name: string, emoji: string, options: readonly Difficulty[], onPick: (id: string) => void,
): void {
  open(h('div', { class: 'panel' },
    h('h2', {}, `${emoji} ${name}`),
    h('p', {}, T.chooseDifficulty),
    h('div', { class: 'row stack' },
      ...options.map((d, i) =>
        h('button', {
          class: `btn ${i === 0 ? 'green' : i === options.length - 1 ? 'red' : 'blue'} wide`,
          onclick: () => { close(); onPick(d.id); },
        },
          h('span', {}, d.label),
          d.note ? h('small', {}, d.note) : null)),
      button(T.close, '', close, 'ghost')),
  ));
}

export function outcomeDialog(
  outcome: 'won' | 'lost', summary: RoundSummary,
  actions: { again: () => void; menu: () => void; carryOn?: () => void },
  sound: { star(i: number): void; win(): void },
): void {
  const starsRow = h('div', { class: 'stars' });
  for (let i = 0; i < 5; i++) {
    starsRow.append(h('span', { class: `star${i < summary.stars ? ' lit' : ''}` }, '★'));
  }

  const rating = h('div', { class: 'rating' });
  const panel = h('div', { class: 'panel' },
    h('h2', {}, outcome === 'won' ? T.wellDone : T.notThisTime),
    outcome === 'won' ? starsRow : null,
    outcome === 'won' ? rating : null,
    h('div', { class: 'final-score' }, summary.score.toLocaleString('he-IL')),
    summary.isBest ? h('div', { class: 'new-best' }, T.newBest) : null,
    h('div', { class: 'summary' },
      h('span', {}, `${T.moves}: ${summary.moves}`),
      h('span', {}, `${T.time}: ${formatTime(summary.seconds)}`)),
    h('div', { class: 'row' },
      // Only where carrying on means something — 2048 past its 2048 tile.
      actions.carryOn
        ? button(T.keepGoing, '▶️', () => { close(); actions.carryOn!(); }, 'blue')
        : null,
      button(T.playAgain, '🔄', () => { close(); actions.again(); }, 'green'),
      button(T.menu, '🏠', () => { close(); actions.menu(); }, 'ghost')),
  );

  open(panel, false);

  if (outcome === 'won') {
    sound.win();
    confetti();
    [...starsRow.children].forEach((star, i) => {
      setTimeout(() => {
        star.classList.add('show');
        if (i < summary.stars) sound.star(i);
      }, 420 + i * 260);
    });
    setTimeout(() => { rating.textContent = T.ratings[summary.stars] ?? ''; },
      420 + summary.stars * 260 + 250);
  }
}

export function messageDialog(title: string, body: string, extra?: HTMLElement): void {
  open(h('div', { class: 'panel' },
    h('h2', {}, title),
    h('p', {}, body),
    h('div', { class: 'row' }, ...(extra ? [extra] : []), button(T.close, '', close, 'green')),
  ));
}

export function htmlDialog(title: string, html: string): void {
  open(h('div', { class: 'panel wide-panel' },
    h('h2', {}, title),
    h('div', { class: 'prose', html }),
    h('div', { class: 'row' }, button(T.gotIt, '', close, 'green')),
  ));
}

export function settingsDialog(
  current: { marks: boolean; size: number; rtl: boolean; sound: boolean },
  onChange: (patch: Partial<typeof current>) => void,
  onHelp: () => void,
): void {
  const L = T.settingsLabels;

  const seg = <V,>(
    label: string, note: string | null, options: ReadonlyArray<{ label: string; value: V }>,
    value: V, apply: (v: V) => void,
  ): HTMLElement => {
    const row = h('div', { class: 'seg' });
    const buttons = options.map((o) =>
      h('button', {
        class: `seg-btn${o.value === value ? ' on' : ''}`,
        onclick: () => {
          apply(o.value);
          for (const b of row.children) b.classList.remove('on');
          buttons[options.indexOf(o)]?.classList.add('on');
        },
      }, o.label));
    row.append(...buttons);
    return h('div', { class: 'field' },
      h('span', { class: 'field-label' }, label),
      row,
      note ? h('small', {}, note) : null);
  };

  open(h('div', { class: 'panel' },
    h('h2', {}, `⚙️ ${T.settings}`),
    seg(L.marks, L.marksNote,
      [{ label: L.off, value: false }, { label: L.on, value: true }],
      current.marks, (v) => onChange({ marks: v })),
    seg(L.size, null,
      L.sizes.map((label, i) => ({ label, value: [1, 1.35, 1.7][i]! })),
      current.size, (v) => onChange({ size: v })),
    seg(L.direction, null,
      [{ label: L.rtl, value: true }, { label: L.ltr, value: false }],
      current.rtl, (v) => onChange({ rtl: v })),
    seg(L.sound, null,
      [{ label: L.soundOn, value: true }, { label: L.soundOff, value: false }],
      current.sound, (v) => onChange({ sound: v })),
    h('div', { class: 'row' },
      button(T.howToPlay, '❓', () => { close(); onHelp(); }, 'ghost'),
      button(T.close, '', close, 'green')),
  ));
}

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export { clear };
