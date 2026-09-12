import { Session, type RoundSummary, type SavedRound } from '../core/engine';
import type { GameDef, GameView, SettingsLike } from '../core/types';
import {
  loadRound, loadSettings, readBest, saveRound, saveSettings, writeBest,
} from '../core/storage';
import { GAMES, HELP_HTML, findGame } from '../games/registry';
import { append, button, clear, h, toast } from './dom';
import { T } from './i18n';
import {
  close as closeOverlay, confirmDialog, difficultyDialog, formatTime, htmlDialog,
  outcomeDialog, settingsDialog,
} from './overlays';
import { createSound } from './sound';

/* Games are heterogeneous in their state type; the shell only ever holds one
   at a time and never inspects it, so `any` is contained to these aliases. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDef = GameDef<any>;
type AnySession = Session<any>;
type AnyView = GameView<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function createShell(root: HTMLElement, version: string): void {
  const settings: SettingsLike = loadSettings();
  const sound = createSound(settings);

  let session: AnySession | null = null;
  let view: AnyView | null = null;
  let clockTimer: number | undefined;

  const home = h('section', { class: 'screen home' });
  const game = h('section', { class: 'screen game', hidden: true });
  const bar = h('header', { class: 'bar' });
  const stats = h('div', { class: 'stats' });
  const boardHost = h('div', { class: 'board-host' });
  game.append(bar, boardHost);
  root.append(home, game);

  /* ---- home -------------------------------------------------------------- */

  function renderHome(): void {
    clear(home);
    const wrap = h('div', { class: 'home-wrap' },
      h('h1', { class: 'title' }, T.appName),
      h('p', { class: 'subtitle' }, T.chooseGame));

    const resumable = GAMES
      .map((def) => ({ def, save: loadRound(def.id) }))
      .find((x): x is { def: AnyDef; save: SavedRound } => x.save !== null);

    if (resumable) {
      const { def, save } = resumable;
      wrap.append(gameCard(
        '▶️', T.resume,
        `${def.name} · ${T.score} ${save.score.total} · ${formatTime(save.seconds)}`,
        null, () => start(def, save.difficulty, save),
      ));
    }

    for (const def of GAMES) {
      const best = bestFor(def);
      wrap.append(gameCard(
        def.emoji, def.name, def.blurb,
        best > 0 ? `🏆 ${T.best}: ${best.toLocaleString('he-IL')}` : null,
        () => pickDifficulty(def),
      ));
    }

    wrap.append(h('div', { class: 'home-row' },
      button(T.howToPlay, '❓', showHelp, 'ghost'),
      button(T.settings, '⚙️', showSettings, 'ghost')));

    home.append(wrap, h('div', { class: 'byline' }, T.byline(version)));
  }

  const bestFor = (def: AnyDef): number => {
    if (!def.difficulties) return readBest(def.id);
    return Math.max(...def.difficulties.map((d) => readBest(`${def.id}:${d.id}`)));
  };

  function gameCard(
    emoji: string, name: string, blurb: string, best: string | null, onClick: () => void,
  ): HTMLElement {
    return h('button', { class: 'game-card', onclick: onClick },
      h('span', { class: 'game-emoji' }, emoji),
      h('span', { class: 'game-text' },
        h('span', { class: 'game-name' }, name),
        h('span', { class: 'game-blurb' }, blurb),
        best ? h('span', { class: 'game-best' }, best) : null));
  }

  function pickDifficulty(def: AnyDef): void {
    sound.resume();
    if (!def.difficulties || def.difficulties.length === 0) { start(def); return; }
    difficultyDialog(def.name, def.emoji, def.difficulties, (id) => start(def, id));
  }

  /* ---- running a round --------------------------------------------------- */

  function start(def: AnyDef, difficulty?: string, restore?: SavedRound): void {
    sound.resume();
    view?.destroy();
    window.clearInterval(clockTimer);

    session = new Session(def, {
      sound,
      settings,
      toast,
      readBest,
      writeBest,
      save: (round) => saveRound(def.id, round),
      events: {
        onRender: () => { view?.render(session!.state); renderStats(); },
        onScore: (delta, event) => {
          if (event === 'advanced' && session!.score.streak >= 2) sound.combo(session!.score.streak);
          if (event === 'broken') sound.comboEnd();
          if (delta !== 0) floatScore(delta);
        },
        onOutcome: (outcome, summary) => showOutcome(def, difficulty, outcome, summary),
      },
    }, {
      ...(difficulty !== undefined ? { difficulty } : {}),
      ...(restore ? { restore } : {}),
    });

    view = def.createView(session);
    clear(boardHost);
    // Order matters twice over: the board has to be on screen before it can
    // measure itself, and the toolbar has to be built first or the board sizes
    // itself against a host that is about to get shorter.
    show(game);
    renderBar(def, difficulty);
    renderStats();
    view.mount(boardHost);

    clockTimer = window.setInterval(renderStats, 1000);
  }

  function renderBar(def: AnyDef, difficulty: string | undefined): void {
    clear(bar);
    const extras = view?.toolbar?.() ?? [];
    bar.append(
      button(T.menu, '🏠', toMenu, 'ghost'),
      button(T.undo, '↩️', doUndo, 'blue'),
      button(T.hint, '💡', doHint, 'green'),
      ...extras.map((b) => button(b.label, b.icon, b.onClick, b.tone ?? 'blue')),
      button(T.newGame, '🔄', () => confirmDialog(
        T.confirmNewTitle, T.confirmNewBody, () => start(def, difficulty),
      ), 'red'),
      button('', '⚙️', showSettings, 'ghost'),
      stats,
    );
  }

  function renderStats(): void {
    if (!session) return;
    clear(stats);
    const extra = view?.stat?.(session.state) ?? null;
    const mult = multiplier(session.score.streak);

    append(stats,
      stat(T.score, String(session.score.total)),
      stat(T.moves, String(session.moves)),
      stat(T.time, formatTime(session.seconds)),
      stat(T.best, readBest(session.bestKey).toLocaleString('he-IL')),
      extra ? stat(extra.label, extra.value) : null,
      mult > 1 ? h('span', { class: 'stat streak' }, `${T.streak} `, h('b', {}, `×${mult}`)) : null,
    );

    const undoBtn = bar.querySelector<HTMLButtonElement>('.btn.blue');
    if (undoBtn) undoBtn.disabled = !session.canUndo;
  }

  const stat = (label: string, value: string): HTMLElement =>
    h('span', { class: 'stat' }, `${label} `, h('b', {}, value));

  const multiplier = (streak: number): number =>
    [1, 1, 1.5, 2, 2.5, 3, 4][Math.min(streak, 6)]!;

  function floatScore(delta: number): void {
    const el = h('div', { class: `float-score${delta < 0 ? ' minus' : ''}` },
      `${delta > 0 ? '+' : ''}${delta}`);
    boardHost.append(el);
    setTimeout(() => el.remove(), 1100);
  }

  /* ---- toolbar actions --------------------------------------------------- */

  function doUndo(): void {
    if (session?.undo()) sound.flip();
  }

  function doHint(): void {
    if (!session) return;
    const hint = session.penaliseForHint();
    if (!hint) { toast(T.noMoves); sound.bad(); return; }
    if (hint.kind === 'pile' && hint.message) toast(hint.message);
    view?.showHint?.(hint);
  }

  function toMenu(): void {
    session?.stopClock();
    window.clearInterval(clockTimer);
    renderHome();
    show(home);
  }

  function showOutcome(
    def: AnyDef, difficulty: string | undefined,
    outcome: 'won' | 'lost', summary: RoundSummary,
  ): void {
    window.clearInterval(clockTimer);
    setTimeout(() => outcomeDialog(outcome, summary, {
      again: () => start(def, difficulty),
      menu: toMenu,
    }, sound), 500);
  }

  /* ---- settings and help ------------------------------------------------- */

  function showSettings(): void {
    settingsDialog(settings, (patch) => {
      Object.assign(settings, patch);
      saveSettings(settings);
      view?.layout();
    }, showHelp);
  }

  const showHelp = (): void => htmlDialog(`❓ ${T.howToPlay}`, HELP_HTML);

  /* ---- plumbing ---------------------------------------------------------- */

  function show(screen: HTMLElement): void {
    closeOverlay();
    home.hidden = screen !== home;
    game.hidden = screen !== game;
  }

  window.addEventListener('resize', () => view?.layout());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) session?.stopClock();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlay();
    if (game.hidden) return;
    if (e.key.toLowerCase() === 'h') doHint();
    if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) doUndo();
  });

  renderHome();
  show(home);

  // Read-only seam for the e2e suite. Exposing it unconditionally keeps the
  // tests honest about what ships, and it grants no ability a player lacks.
  Object.defineProperty(window, '__shell', {
    value: {
      get session(): AnySession | null { return session; },
      get view(): AnyView | null { return view; },
      start(id: string, difficulty?: string): void {
        const def = findGame(id);
        if (def) start(def, difficulty);
      },
      toMenu,
    },
  });
}
