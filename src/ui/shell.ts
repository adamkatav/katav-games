import { Session, type RoundSummary, type SavedRound } from '../core/engine';
import type { GameDef, GameView, SettingsLike, ToolbarButton } from '../core/types';
import {
  loadRound, loadSettings, readBest, saveRound, saveSettings, writeBest,
} from '../core/storage';
import { GAMES, HELP_HTML, findGame } from '../games/registry';
import { button, clear, h, toast } from './dom';
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

    // A grid rather than a list: with six games a stacked list cannot fit a
    // phone, and the home screen is the one place that must never scroll.
    const grid = h('div', { class: 'game-grid' });

    const resumable = GAMES
      .map((def) => ({ def, save: loadRound(def.id) }))
      .find((x): x is { def: AnyDef; save: SavedRound } => x.save !== null);

    if (resumable) {
      const { def, save } = resumable;
      const card = gameCard(
        '▶️', T.resume,
        `${def.name} · ${save.score.total} · ${formatTime(save.seconds)}`,
        null, () => start(def, save.difficulty, save),
      );
      card.classList.add('resume');       // spans the full width
      grid.append(card);
    }

    for (const def of GAMES) {
      const best = bestFor(def);
      grid.append(gameCard(
        def.emoji, def.name, def.blurb,
        best > 0 ? `🏆 ${best.toLocaleString('he-IL')}` : null,
        () => pickDifficulty(def),
      ));
    }

    wrap.append(grid, h('div', { class: 'home-row' },
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
    session?.recordBest();     // abandoning for a new round still counts
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

  /* Held by reference rather than re-queried: the old code found undo with
     `.btn.blue`, which only worked while undo happened to be the first blue
     button, and rebuilt the whole stats bar once a second. */
  let undoBtn: HTMLButtonElement | null = null;
  let extraButtons: Array<{ el: HTMLButtonElement; spec: ToolbarButton }> = [];
  let statFields: Record<string, HTMLElement> = {};
  let streakEl: HTMLElement | null = null;

  function renderBar(def: AnyDef, difficulty: string | undefined): void {
    clear(bar);
    extraButtons = [];

    bar.append(button(T.menu, '🏠', toMenu, 'ghost'));

    undoBtn = def.canUndo ? button(T.undo, '↩️', doUndo, 'blue') : null;
    if (undoBtn) bar.append(undoBtn);          // no button where undo would lie

    bar.append(button(T.hint, '💡', doHint, 'green'));

    for (const spec of view?.toolbar?.() ?? []) {
      const el = button(spec.label, spec.icon, () => { spec.onClick(); syncToolbar(); },
        spec.tone ?? 'blue');
      extraButtons.push({ el, spec });
      bar.append(el);
    }

    bar.append(
      button(T.newGame, '🔄', () => confirmDialog(
        T.confirmNewTitle, T.confirmNewBody, () => start(def, difficulty),
      ), 'red'),
      button('', '⚙️', showSettings, 'ghost'),
      stats,
    );

    buildStats();
    syncToolbar();
  }

  function syncToolbar(): void {
    for (const { el, spec } of extraButtons) {
      el.classList.toggle('active', spec.isActive?.() ?? false);
    }
  }

  function buildStats(): void {
    clear(stats);
    statFields = {};
    const extra = session && view?.stat?.(session.state);

    const add = (key: string, label: string): void => {
      const value = h('b', {}, '');
      stats.append(h('span', { class: 'stat' }, `${label} `, value));
      statFields[key] = value;
    };

    add('score', T.score);
    add('moves', T.moves);
    add('time', T.time);
    add('best', T.best);
    if (extra) add('extra', extra.label);

    streakEl = h('span', { class: 'stat streak', hidden: true }, `${T.streak} `, h('b', {}, ''));
    stats.append(streakEl);
  }

  function renderStats(): void {
    if (!session) return;
    const extra = view?.stat?.(session.state) ?? null;

    // A game-specific stat can change its label (Spider's sets vs FreeCell's
    // cells), so rebuild only when the shape actually differs.
    if ((extra !== null) !== ('extra' in statFields)) buildStats();

    const set = (key: string, value: string): void => {
      const el = statFields[key];
      if (el && el.textContent !== value) el.textContent = value;
    };

    set('score', String(session.score.total));
    set('moves', String(session.moves));
    set('time', formatTime(session.seconds));
    set('best', readBest(session.bestKey).toLocaleString('he-IL'));
    if (extra) set('extra', extra.value);

    const mult = multiplier(session.score.streak);
    if (streakEl) {
      streakEl.hidden = mult <= 1;
      const b = streakEl.querySelector('b');
      if (b) b.textContent = `×${mult}`;
    }

    if (undoBtn) undoBtn.disabled = !session.canUndo;
  }

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
    // Every hint kind can carry a message, and for Sudoku, Minesweeper and 2048
    // the message *is* the hint — which digit, which rule, which direction.
    // Only showing it for pile hints made those three flash a cell and say
    // nothing useful.
    if ('message' in hint && hint.message) toast(hint.message);
    view?.showHint?.(hint);
  }

  function toMenu(): void {
    session?.stopClock();
    session?.recordBest();     // leaving mid-round still counts toward the best
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
