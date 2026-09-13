import type { GameDef, GameView, Hint, Rng, ViewHost } from '../../core/types';
import { computeGridGeometry, paddingOf, type GridGeometry } from '../grid/layout';
import {
  CELLS, SIZE, TARGET, canMove, createState, maxTile, slide, spawn,
  type Direction, type G2048State,
} from './logic';

/**
 * 2048 draws its own board rather than using the shared cell renderer: tiles
 * need to slide from where they were, which means keeping an element per tile
 * id instead of repainting a grid of cells.
 */

/**
 * The grid is never mirrored for RTL — unlike a card tableau it has no reading
 * direction, and mirroring it inverted every control: pressing ArrowLeft slid
 * the tiles visually right. Left is left.
 *
 * `area` places each button in a D-pad, which also keeps the layout from being
 * flipped by the surrounding RTL document.
 */
const ARROWS: ReadonlyArray<{ dir: Direction; icon: string; label: string; area: string }> = [
  { dir: 'up', icon: '↑', label: 'למעלה', area: '1 / 2 / 2 / 3' },
  { dir: 'left', icon: '←', label: 'שמאלה', area: '2 / 1 / 3 / 2' },
  { dir: 'down', icon: '↓', label: 'למטה', area: '2 / 2 / 3 / 3' },
  { dir: 'right', icon: '→', label: 'ימינה', area: '2 / 3 / 3 / 4' },
];

/**
 * One move in a direction: slide, spawn, and note the target being reached.
 *
 * Exported so a scripted test drives the same code the arrow buttons, the keys
 * and a swipe all funnel into. A direction that changes nothing is refused
 * before `commit`, so it costs neither a move nor an undo step — the move count
 * feeds par and the stars, and pressing into a wall is not a move.
 */
export function performMove(host: ViewHost<G2048State>, dir: Direction): boolean {
  const probe = JSON.parse(JSON.stringify(host.state)) as G2048State;
  if (!slide(probe, dir).moved) { host.sound.bad(); return false; }

  host.commit((d) => {
    slide(d, dir);
    spawn(d);
    if (!d.reached && maxTile(d) >= TARGET) d.reached = true;
  });
  host.sound.place();
  return true;
}

export const g2048: GameDef<G2048State> = {
  id: 'g2048' as GameDef<G2048State>['id'],
  name: '2048',
  emoji: '🔟',
  blurb: 'לחבר מספרים זהים עד 2048',
  canUndo: true,
  hasLoss: true,

  create: (rng: Rng) => createState(rng.int(0x7fffffff)),

  // Pure in state: undo restores the accumulator with everything else, so the
  // same position always carries the same score.
  score: (s) => s.merged,

  isWon: (s) => s.reached && !s.keepGoing,
  isLost: (s) => !canMove(s),

  // The help says the player may carry on past 2048, so they can: the round
  // reopens and from then on ends only when the board fills up.
  continueAfterWin: (s) => { s.keepGoing = true; },

  hint(s): Hint | null {
    // Suggest a direction that actually changes the board, preferring one that
    // merges. Cheap to evaluate: try each on a copy.
    let best: { dir: Direction; gained: number } | null = null;
    for (const { dir } of ARROWS) {
      const copy: G2048State = JSON.parse(JSON.stringify(s)) as G2048State;
      const { moved, gained } = slide(copy, dir);
      if (!moved) continue;
      if (!best || gained > best.gained) best = { dir, gained };
    }
    if (!best) return null;
    const arrow = ARROWS.find((a) => a.dir === best!.dir)!;
    return { kind: 'cell', index: 0, message: `נסו להזיז ${arrow.label} ${arrow.icon}` };
  },

  par: () => ({ moves: 250, time: 600 }),

  createView: (host) => createBoardView(host),
};

function createBoardView(host: ViewHost<G2048State>): GameView<G2048State> {
  let root!: HTMLElement;
  let wrap!: HTMLElement;
  let grid!: HTMLElement;
  let pad!: HTMLElement;
  let geometry: GridGeometry | null = null;
  let observer: ResizeObserver | null = null;
  const tileEls = new Map<number, HTMLElement>();

  function mount(container: HTMLElement): void {
    root = container;
    root.innerHTML =
      '<div class="grid-board"><div class="g2048"><div class="g2048-bg"></div></div></div>';
    wrap = root.querySelector('.grid-board')!;
    grid = root.querySelector('.g2048')!;

    const bg = root.querySelector('.g2048-bg')!;
    for (let i = 0; i < CELLS; i++) bg.append(document.createElement('div'));

    pad = buildPad();
    wrap.append(pad);

    // Arrow buttons are the primary input, as the design rules require;
    // keys and swipe are accelerators layered on top.
    window.addEventListener('keydown', onKey);
    attachSwipe();

    observer?.disconnect();
    observer = new ResizeObserver(() => scheduleLayout());
    observer.observe(root);
    layout();
  }

  function buildPad(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'pad g2048-pad';
    for (const { dir, icon, label, area } of ARROWS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = icon;
      b.title = label;
      b.setAttribute('aria-label', label);
      b.style.gridArea = area;
      b.addEventListener('click', () => move(dir));
      el.append(b);
    }
    return el;
  }

  const onKey = (e: KeyboardEvent): void => {
    const map: Record<string, Direction> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const dir = map[e.key];
    if (dir) { e.preventDefault(); move(dir); }
  };

  function attachSwipe(): void {
    let x0 = 0, y0 = 0, tracking = false;
    grid.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; tracking = true; });
    grid.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.hypot(dx, dy) < 30) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
  }

  const move = (dir: Direction): void => { performMove(host, dir); };

  let layoutQueued = false;
  function scheduleLayout(): void {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; if (root.isConnected) layout(); });
  }

  function layout(): void {
    if (root.clientWidth < 40 || root.clientHeight < 40) {
      requestAnimationFrame(() => { if (root.isConnected) layout(); });
      return;
    }
    // Beside the board on a phone held sideways, under it everywhere else; the
    // stylesheet decides and this reads the answer back.
    const beside = getComputedStyle(wrap).flexDirection.startsWith('row');
    const inset = paddingOf(root);

    geometry = computeGridGeometry({
      cols: SIZE, rows: SIZE,
      availableW: root.clientWidth - inset.x - (beside ? pad.offsetWidth + 14 : 0),
      availableH: root.clientHeight - inset.y,
      reservedH: beside ? 0 : pad.offsetHeight + 14,
      sizeScale: host.settings.size,
      minCell: 54,
      maxCell: 150,
    });
    grid.style.setProperty('--cell', `${geometry.cell}px`);
    grid.style.setProperty('--gap', `${geometry.gap}px`);
    grid.style.width = `${geometry.width}px`;
    grid.style.height = `${geometry.height}px`;
    render(host.state);
  }

  function render(state: G2048State): void {
    if (!geometry) return;
    const step = geometry.cell + geometry.gap;
    const live = new Set<number>();

    for (const tile of state.tiles) {
      live.add(tile.id);
      let el = tileEls.get(tile.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile';
        grid.append(el);
        tileEls.set(tile.id, el);
      }
      const col = tile.at % SIZE;
      const row = Math.floor(tile.at / SIZE);
      el.style.transform = `translate(${col * step}px,${row * step}px)`;
      el.textContent = String(tile.value);
      el.className = `tile v${Math.min(tile.value, 4096)}` +
        (tile.born ? ' born' : '') + (tile.merged ? ' merged' : '');
    }

    for (const [id, el] of tileEls) {
      if (live.has(id)) continue;
      el.remove();                    // absorbed by a merge
      tileEls.delete(id);
    }
  }

  return {
    mount,
    render,
    layout,
    destroy() {
      observer?.disconnect();
      window.removeEventListener('keydown', onKey);
      root.innerHTML = '';
      tileEls.clear();
    },
    stat: (s) => ({ label: 'הכי גדול', value: String(maxTile(s)) }),
    showHint() { /* the hint is a direction, delivered as a toast */ },
  };
}
