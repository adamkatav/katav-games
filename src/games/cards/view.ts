import type { GameView, Hint, ToolbarButton, ViewHost } from '../../core/types';
import type { Card, PileId } from './deck';
import { topOf } from './deck';
import { BACK_URL, CREST_URL, faceSvg } from './art';
import { cardPosition, computeGeometry, requiredRatio, type Geometry } from './layout';
import type { CardSpec, CardState } from './model';

interface Location { pile: PileId; index: number }

/**
 * The board every card game shares: rendering, tap-to-move, optional drag,
 * animation and the celebration when a column clears. Games contribute only
 * rules; none of this is per-game.
 */
export function createCardView(host: ViewHost<CardState>, spec: CardSpec): GameView<CardState> {
  let root!: HTMLElement;
  let board!: HTMLElement;
  let geometry: Geometry | null = null;
  let fanCap = 0;
  let selection: Location | null = null;
  let emptyColumns = new Set<PileId>();
  let resizeObserver: ResizeObserver | null = null;

  const slots = new Map<PileId, HTMLElement>();
  const cardEls = new Map<number, HTMLElement>();

  const layoutSpec = () => spec.layoutOf(host.state);
  const allPiles = () => {
    const l = layoutSpec();
    return [...l.top.map((t) => t.pile), ...l.tableau];
  };

  /* ---- building ---------------------------------------------------------- */

  function mount(container: HTMLElement): void {
    root = container;
    root.innerHTML = '<div class="board" part="board"></div>';
    board = root.querySelector('.board')!;
    slots.clear();
    cardEls.clear();

    for (const pile of allPiles()) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset['pile'] = pile;
      if (pile === 'stock') slot.textContent = '↻';
      board.appendChild(slot);
      slots.set(pile, slot);
    }

    for (const card of everyCard()) {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset['card'] = String(card.id);
      el.innerHTML =
        '<div class="inner">' +
        `<div class="face front">${faceSvg(card)}</div>` +
        `<div class="face back" style="background-image:url(${BACK_URL})"></div>` +
        '</div>';
      board.appendChild(el);
      cardEls.set(card.id, el);
    }

    attachInput();
    emptyColumns = currentEmpties();

    // The toolbar wraps to a second row at some widths, which changes the
    // height available to the board after it has already sized itself.
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => scheduleLayout());
    resizeObserver.observe(root);

    layout();
  }

  /**
   * Resizing the board can toggle the host's scrollbar, which changes the
   * host's width and re-fires the observer. Coalescing into one frame keeps
   * that from ping-ponging (and from logging a ResizeObserver loop warning).
   */
  let layoutQueued = false;
  function scheduleLayout(): void {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      if (root.isConnected) layout();
    });
  }

  const everyCard = (): Card[] => Object.values(host.state.piles).flat();

  const currentEmpties = (): Set<PileId> =>
    new Set(layoutSpec().tableau.filter((p) => (host.state.piles[p]?.length ?? 0) === 0));

  /* ---- geometry ---------------------------------------------------------- */

  const gapRatioNow = (): number =>
    layoutSpec().columns >= 10 && root.clientWidth < 700 ? 0.05 : 0.12;

  /** Recompute geometry and place the slots. Does not draw the cards. */
  function applyGeometry(): void {
    const spec2 = layoutSpec();
    geometry = computeGeometry(host.state, spec2, {
      availableW: root.clientWidth - 20,
      availableH: root.clientHeight - 20,
      rtl: host.settings.rtl,
      sizeScale: host.settings.size,
      fanCap,
    });

    board.style.setProperty('--card-w', `${geometry.cardW}px`);
    board.style.setProperty('--card-h', `${geometry.cardH}px`);
    board.style.width = `${geometry.boardW}px`;
    board.style.height = `${geometry.boardH}px`;

    for (const [pile, el] of slots) {
      const g = geometry.piles[pile];
      if (g) el.style.transform = `translate(${g.x}px,${g.y}px)`;
    }
  }

  function layout(): void {
    // Measuring a hidden or not-yet-laid-out host yields zero and would clamp
    // every card to the minimum size; try again once it has a box.
    if (root.clientWidth < 40 || root.clientHeight < 40) {
      requestAnimationFrame(() => { if (root.isConnected) layout(); });
      return;
    }
    fanCap = Math.max(fanCap, requiredRatio(host.state, layoutSpec(), gapRatioNow()));
    applyGeometry();
    render(host.state);
  }

  /* ---- rendering --------------------------------------------------------- */

  function render(state: CardState): void {
    if (!geometry) return;
    const spec2 = layoutSpec();

    // A column that just got deeper can outgrow the current card size. The
    // engine only calls render() after a move, so without this the cards never
    // shrink during play and the board silently starts scrolling again.
    const need = requiredRatio(state, spec2, gapRatioNow());
    if (need > fanCap + 1e-6) { fanCap = need; applyGeometry(); }

    let z = 1;

    for (const pile of allPiles()) {
      const cards = state.piles[pile] ?? [];
      cards.forEach((card, i) => {
        const el = cardEls.get(card.id);
        if (!el) return;
        const pos = cardPosition(geometry!, state, pile, i);
        el.style.transform = `translate(${pos.x}px,${pos.y}px)`;
        el.style.zIndex = String(++z);
        el.style.opacity = '1';
        el.classList.toggle('up', card.up);
        el.classList.remove('selected', 'target');
      });
    }

    // Completed Spider sets stack in one slot; only the top card should show.
    for (const pile of spec2.stacked) {
      if (!pile.startsWith('c')) continue;
      const cards = state.piles[pile] ?? [];
      cards.forEach((card, i) => {
        const el = cardEls.get(card.id);
        if (el) el.style.opacity = i === cards.length - 1 ? '1' : '0';
      });
    }

    const stockSlot = slots.get('stock');
    if (stockSlot) {
      const left = state.piles['stock']?.length ?? 0;
      stockSlot.textContent = spec.id === 'spider'
        ? (left > 0 ? String(Math.floor(left / 10)) : '')
        : (left > 0 ? '' : '↻');
    }

    paintSelection();
    celebrateNewEmpties();
  }

  function paintSelection(): void {
    for (const el of cardEls.values()) el.classList.remove('selected', 'target');
    for (const el of slots.values()) el.classList.remove('target');
    if (!selection) return;

    const run = (host.state.piles[selection.pile] ?? []).slice(selection.index);
    for (const card of run) cardEls.get(card.id)?.classList.add('selected');

    if (!host.settings.marks) return;    // destination marking is opt-in
    for (const pile of allPiles()) {
      if (!spec.canDrop(host.state, run, pile, selection.pile)) continue;
      const t = topOf(host.state.piles, pile);
      if (t && !pile.startsWith('c')) cardEls.get(t.id)?.classList.add('target');
      else slots.get(pile)?.classList.add('target');
    }
  }

  /* ---- clearing a column ------------------------------------------------- */

  function celebrateNewEmpties(): void {
    const now = currentEmpties();
    for (const pile of now) {
      if (emptyColumns.has(pile)) continue;
      const g = geometry?.piles[pile];
      if (!g) continue;
      host.sound.space();
      const fx = document.createElement('div');
      fx.className = 'clear-fx';
      fx.style.cssText =
        `left:${g.x}px;top:${g.y}px;width:${geometry!.cardW}px;height:${geometry!.cardH}px`;
      fx.innerHTML = `<img src="${CREST_URL}" alt="">`;
      board.appendChild(fx);
      setTimeout(() => fx.remove(), 1900);
    }
    emptyColumns = now;
  }

  function flash(pile: PileId, cardId?: number): void {
    const el = cardId !== undefined ? cardEls.get(cardId) : slots.get(pile);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2400);
  }

  /* ---- input ------------------------------------------------------------- */

  function locate(target: EventTarget | null): Location | null {
    const el = target as HTMLElement | null;
    const cardEl = el?.closest<HTMLElement>('.card');
    if (cardEl) {
      const id = Number(cardEl.dataset['card']);
      for (const pile of allPiles()) {
        const i = (host.state.piles[pile] ?? []).findIndex((c) => c.id === id);
        if (i >= 0) return { pile, index: i };
      }
    }
    const slot = el?.closest<HTMLElement>('.slot');
    if (slot) return { pile: slot.dataset['pile']!, index: -1 };
    return null;
  }

  function pileAt(px: number, py: number): PileId | null {
    if (!geometry) return null;
    let best: PileId | null = null;
    for (const pile of allPiles()) {
      const g = geometry.piles[pile];
      if (!g) continue;
      const cards = host.state.piles[pile] ?? [];
      let h = geometry.cardH;
      if (g.faceUp > 0 && cards.length > 0) {
        const down = cards.filter((c) => !c.up).length;
        h = down * g.faceDown + Math.max(0, cards.length - down - 1) * g.faceUp + geometry.cardH;
      }
      const withinX = px >= g.x - geometry.gap / 2 && px <= g.x + geometry.cardW + geometry.gap / 2;
      const withinY = py >= g.y - 6 && py <= g.y + h + 6;
      if (withinX && withinY && (!best || g.y > geometry.piles[best]!.y)) best = pile;
    }
    return best;
  }

  let drag: { from: Location; cards: Card[]; offsets: Array<{ dx: number; dy: number }>; moved: boolean; x0: number; y0: number } | null = null;
  let lastTap: { pile: PileId; index: number; at: number } | null = null;

  function attachInput(): void {
    board.addEventListener('pointerdown', (e) => {
      const loc = locate(e.target);
      if (!loc || loc.pile === 'stock' || loc.index < 0) return;
      if (!spec.canGrab(host.state, loc.pile, loc.index)) return;
      const rect = board.getBoundingClientRect();
      const cards = (host.state.piles[loc.pile] ?? []).slice(loc.index);
      drag = {
        from: loc, cards, moved: false, x0: e.clientX, y0: e.clientY,
        offsets: cards.map((_, k) => {
          const pos = cardPosition(geometry!, host.state, loc.pile, loc.index + k);
          return { dx: pos.x - (e.clientX - rect.left), dy: pos.y - (e.clientY - rect.top) };
        }),
      };
      board.setPointerCapture(e.pointerId);
    });

    board.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
        drag.moved = true;
        for (const c of drag.cards) cardEls.get(c.id)?.classList.add('dragging');
      }
      const rect = board.getBoundingClientRect();
      drag.cards.forEach((c, k) => {
        const o = drag!.offsets[k]!;
        const el = cardEls.get(c.id);
        if (el) el.style.transform =
          `translate(${e.clientX - rect.left + o.dx}px,${e.clientY - rect.top + o.dy}px)`;
      });
    });

    board.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      for (const c of d.cards) cardEls.get(c.id)?.classList.remove('dragging');
      if (!d.moved) { tap(d.from); return; }

      const rect = board.getBoundingClientRect();
      const dest = pileAt(e.clientX - rect.left, e.clientY - rect.top);
      if (dest && spec.canDrop(host.state, d.cards, dest, d.from.pile)) {
        move(d.from, dest);
      } else {
        if (dest && dest !== d.from.pile) {
          const why = spec.whyNot(host.state, d.cards, dest);
          if (why) host.toast(why);
        }
        host.sound.bad();
        selection = null;
        render(host.state);
      }
    });

    board.addEventListener('pointercancel', () => {
      if (!drag) return;
      for (const c of drag.cards) cardEls.get(c.id)?.classList.remove('dragging');
      drag = null;
      render(host.state);
    });

    board.addEventListener('click', (e) => {
      const loc = locate(e.target);
      if (!loc) return;
      if (loc.pile === 'stock') { selection = null; spec.onStock?.(host.state, host); return; }
      // Empty slots never reach the pointer handlers: pointerdown refuses to
      // start a drag from one, so pointerup returns early and the tap is lost.
      // Without this, placing a card on an empty column is impossible.
      if (loc.index < 0) tap(loc);
    });
  }

  function tap(loc: Location): void {
    // Double-tap sends a card to its foundation. An accelerator only — the
    // two-tap path below is always available and never requires a double-click.
    const now = Date.now();
    const isDouble = lastTap && lastTap.pile === loc.pile && lastTap.index === loc.index
      && now - lastTap.at < 450;
    lastTap = { pile: loc.pile, index: loc.index, at: now };

    const cards = host.state.piles[loc.pile] ?? [];
    if (isDouble && loc.index === cards.length - 1 && loc.index >= 0) {
      const card = cards[loc.index]!;
      const foundation = allPiles().find(
        (p) => p.startsWith('f') && spec.canDrop(host.state, [card], p, loc.pile),
      );
      if (foundation) { lastTap = null; move(loc, foundation); return; }
    }

    if (selection) {
      if (selection.pile === loc.pile && selection.index === loc.index) {
        selection = null; render(host.state); return;
      }
      const run = (host.state.piles[selection.pile] ?? []).slice(selection.index);
      if (spec.canDrop(host.state, run, loc.pile, selection.pile)) {
        move(selection, loc.pile);
        return;
      }
      // Refusing in silence is what left the player with no idea why a card
      // would not move, so say why and keep the selection for another target.
      if (loc.index < 0 && loc.pile !== 'stock') {
        const why = spec.whyNot(host.state, run, loc.pile);
        if (why) host.toast(why);
        host.sound.bad();
        return;
      }
    }

    if (loc.index < 0) { selection = null; render(host.state); return; }

    const card = cards[loc.index];
    if (!card) return;

    if (!spec.canGrab(host.state, loc.pile, loc.index)) {
      // Tapping inside a run selects the largest legal run that contains it.
      let k = loc.index;
      while (k < cards.length && !spec.canGrab(host.state, loc.pile, k)) k++;
      if (k < cards.length) {
        selection = { pile: loc.pile, index: k };
        host.sound.select();
        render(host.state);
        return;
      }
      host.sound.bad();
      selection = null;
      render(host.state);
      return;
    }

    selection = { pile: loc.pile, index: loc.index };
    host.sound.select();
    render(host.state);
  }

  function move(from: Location, to: PileId): void {
    selection = null;
    host.commit((draft) => {
      const source = draft.piles[from.pile]!;
      const run = source.splice(from.index);
      if (run.length === 0) return;
      draft.piles[to]!.push(...run);
      spec.afterMove?.(draft, host);
    });
    host.sound[to.startsWith('f') ? 'found' : 'place']();
  }

  /* ---- public ------------------------------------------------------------ */

  return {
    mount,
    render,
    layout,
    destroy() { resizeObserver?.disconnect(); root.innerHTML = ''; slots.clear(); cardEls.clear(); },
    stat: (state) => spec.stat?.(state) ?? null,
    toolbar(): readonly ToolbarButton[] {
      if (spec.id === 'spider') return [];
      return [{
        id: 'autocollect',
        label: 'אסוף הכל',
        icon: '⬆️',
        tone: 'green',
        onClick: () => autoCollect(),
      }];
    },
    showHint,
  };

  function showHint(hint: Hint): void {
    if (hint.kind === 'pile') { flash(hint.pile); return; }
    if (hint.kind !== 'move') return;
    const card = (host.state.piles[hint.from] ?? [])[hint.index];
    if (card) flash(hint.from, card.id);
    const target = topOf(host.state.piles, hint.to);
    if (target) flash(hint.to, target.id); else flash(hint.to);
  }

  function autoCollect(): void {
    const step = (): void => {
      const sources = allPiles().filter((p) => !p.startsWith('f'));
      for (const p of sources) {
        const t = topOf(host.state.piles, p);
        if (!t || !t.up) continue;
        const f = allPiles().find(
          (d) => d.startsWith('f') && spec.canDrop(host.state, [t], d, p),
        );
        if (f) {
          move({ pile: p, index: (host.state.piles[p]?.length ?? 1) - 1 }, f);
          setTimeout(step, 170);
          return;
        }
      }
    };
    step();
  }
}
