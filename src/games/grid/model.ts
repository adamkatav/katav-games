import type {
  Difficulty, GameDef, GameId, GameView, Hint, Par, Rng, ToolbarButton, ViewHost,
} from '../../core/types';
import { cellPosition, computeGridGeometry, type GridGeometry } from './layout';

/** How one cell should look right now. Games return this; the view draws it. */
export interface CellView {
  readonly text?: string;
  /** space-separated modifier classes, e.g. 'revealed n3' or 'given' */
  readonly cls?: string;
  /** multiplier on the default label size, for smaller marks */
  readonly scale?: number;
}

export interface GridSpec<S> {
  readonly id: GameId;
  readonly name: string;
  readonly emoji: string;
  readonly blurb: string;
  readonly difficulties?: readonly Difficulty[];
  readonly canUndo: boolean;
  readonly hasLoss: boolean;
  /** below this a cell label stops being readable */
  readonly minCell?: number;
  /** 0 makes the cells touch, for a board ruled with lines instead of gaps */
  readonly gapRatio?: number;
  /** extra class on the grid element, for board-specific decoration */
  readonly gridClass?: string;

  create(rng: Rng, difficulty?: string): S;
  dims(state: S): { cols: number; rows: number };
  cell(state: S, index: number): CellView;
  /**
   * A tap on a cell. `secondary` is true for a right-click or long-press —
   * always an accelerator, never the only way to reach an action.
   */
  onCell(state: S, index: number, host: ViewHost<S>, secondary?: boolean): void;

  score(state: S): number;
  isWon(state: S): boolean;
  isLost?(state: S): boolean;
  hint(state: S): Hint | null;
  par(difficulty?: string): Par;

  stat?(state: S): { label: string; value: string } | null;
  toolbar?(host: ViewHost<S>, refresh: () => void): readonly ToolbarButton[];
  /** persistent game-owned controls under the board: a number pad, arrows */
  controls?(host: ViewHost<S>, refresh: () => void): HTMLElement | null;
}

export function createGridGame<S>(spec: GridSpec<S>): GameDef<S> {
  return {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    blurb: spec.blurb,
    ...(spec.difficulties ? { difficulties: spec.difficulties } : {}),
    canUndo: spec.canUndo,
    hasLoss: spec.hasLoss,

    create: (rng, difficulty) => spec.create(rng, difficulty),
    score: (s) => spec.score(s),
    isWon: (s) => spec.isWon(s),
    ...(spec.isLost ? { isLost: (s: S) => spec.isLost!(s) } : {}),
    hint: (s) => spec.hint(s),
    par: (d) => spec.par(d),

    createView: (host) => createGridView(host, spec),
  };
}

function createGridView<S>(host: ViewHost<S>, spec: GridSpec<S>): GameView<S> {
  let root!: HTMLElement;
  let board!: HTMLElement;
  let grid!: HTMLElement;
  let controls: HTMLElement | null = null;
  let cells: HTMLElement[] = [];
  let geometry: GridGeometry | null = null;
  let observer: ResizeObserver | null = null;

  const dims = () => spec.dims(host.state);

  function mount(container: HTMLElement): void {
    root = container;
    root.innerHTML = '<div class="grid-board"><div class="grid"></div></div>';
    board = root.querySelector('.grid-board')!;
    grid = root.querySelector('.grid')!;
    if (spec.gridClass) grid.classList.add(spec.gridClass);

    controls = spec.controls?.(host, () => { refreshControls(); render(host.state); }) ?? null;
    if (controls) board.append(controls);

    buildCells();
    attachInput();

    observer?.disconnect();
    observer = new ResizeObserver(() => scheduleLayout());
    observer.observe(root);
    layout();
  }

  // Coalesce into one frame: resizing the board can toggle the host scrollbar,
  // which resizes the host, which would re-fire the observer.
  let layoutQueued = false;
  function scheduleLayout(): void {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      if (root.isConnected) layout();
    });
  }

  function buildCells(): void {
    const { cols, rows } = dims();
    grid.innerHTML = '';
    cells = Array.from({ length: cols * rows }, (_, i) => {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset['i'] = String(i);
      grid.append(el);
      return el;
    });
  }

  function refreshControls(): void {
    if (!controls) return;
    const next = spec.controls?.(host, () => { refreshControls(); render(host.state); }) ?? null;
    if (next) { controls.replaceWith(next); controls = next; }
  }

  function layout(): void {
    if (root.clientWidth < 40 || root.clientHeight < 40) {
      requestAnimationFrame(() => { if (root.isConnected) layout(); });
      return;
    }
    const { cols, rows } = dims();
    if (cells.length !== cols * rows) buildCells();

    const reserved = controls ? controls.offsetHeight + 14 : 0;
    geometry = computeGridGeometry({
      cols, rows,
      availableW: root.clientWidth - 20,
      availableH: root.clientHeight - 20,
      reservedH: reserved,
      sizeScale: host.settings.size,
      ...(spec.minCell !== undefined ? { minCell: spec.minCell } : {}),
      ...(spec.gapRatio !== undefined ? { gapRatio: spec.gapRatio } : {}),
    });

    grid.style.setProperty('--cell', `${geometry.cell}px`);
    grid.style.width = `${geometry.width}px`;
    grid.style.height = `${geometry.height}px`;

    cells.forEach((el, i) => {
      const pos = cellPosition(geometry!, cols, i, host.settings.rtl);
      el.style.transform = `translate(${pos.x}px,${pos.y}px)`;
    });

    render(host.state);
  }

  function render(state: S): void {
    const { cols, rows } = dims();
    if (cells.length !== cols * rows) { buildCells(); layout(); return; }

    cells.forEach((el, i) => {
      const view = spec.cell(state, i);
      const cls = `cell ${view.cls ?? ''}`.trim();
      if (el.className !== cls) el.className = cls;
      const text = view.text ?? '';
      if (el.textContent !== text) el.textContent = text;
      const scale = view.scale ?? 1;
      const size = `calc(var(--cell) * ${0.52 * scale})`;
      if (el.style.fontSize !== size) el.style.fontSize = size;
    });
  }

  function attachInput(): void {
    // Read the cell off the event target rather than hit-testing coordinates.
    // Grid cells are real elements that already know their index, so this is
    // exact, needs no RTL arithmetic, and works for synthetic clicks too.
    const indexOf = (e: Event): number | null => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.cell');
      const raw = el?.dataset['i'];
      return raw === undefined ? null : Number(raw);
    };

    grid.addEventListener('click', (e) => {
      const i = indexOf(e);
      if (i !== null) spec.onCell(host.state, i, host, false);
    });

    // Right-click as an accelerator. The same action is always reachable
    // through the toolbar mode switch, so nothing *requires* a second button.
    grid.addEventListener('contextmenu', (e) => {
      const i = indexOf(e);
      if (i === null) return;
      e.preventDefault();
      spec.onCell(host.state, i, host, true);
    });
  }

  return {
    mount,
    render,
    layout,
    destroy() { observer?.disconnect(); root.innerHTML = ''; cells = []; },
    ...(spec.stat ? { stat: (s: S) => spec.stat!(s) } : {}),
    toolbar: () => spec.toolbar?.(host, () => render(host.state)) ?? [],
    showHint(hint: Hint) {
      if (hint.kind !== 'cell') return;
      const el = cells[hint.index];
      if (!el) return;
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 2400);
    },
  };
}
