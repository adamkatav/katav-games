import type { ViewHost } from '../../core/types';
import type { PileId } from './deck';
import type { CardSpec, CardState } from './model';

/**
 * Applying a move is the one thing every card game does identically, and the
 * only place a tableau is ever mutated.
 *
 * It lives here rather than inside the view so a scripted test can drive the
 * same code a tap drives. The view still owns *deciding* to move — selection,
 * drag, double-tap — which is what the browser tests cover.
 */
export function performMove(
  host: ViewHost<CardState>,
  spec: CardSpec,
  from: PileId,
  index: number,
  to: PileId,
): void {
  host.commit((draft) => {
    const source = draft.piles[from]!;
    const run = source.splice(index);
    if (run.length === 0) return;
    draft.piles[to]!.push(...run);
    spec.afterMove?.(draft, host);
  });
  host.sound[to.startsWith('f') ? 'found' : 'place']();
}

/**
 * Offer a run to a pile: move it when the rules allow, and otherwise say why in
 * Hebrew. A refusal the player cannot explain is the single most confusing
 * thing for this audience, so the reason is part of the action, not a nicety.
 *
 * Returns whether the move happened.
 */
export function attemptMove(
  host: ViewHost<CardState>,
  spec: CardSpec,
  from: PileId,
  index: number,
  to: PileId,
): boolean {
  const run = (host.state.piles[from] ?? []).slice(index);
  if (run.length > 0 && spec.canDrop(host.state, run, to, from)) {
    performMove(host, spec, from, index, to);
    return true;
  }
  if (to !== from) {
    const why = spec.whyNot(host.state, run, to);
    if (why) host.toast(why);
  }
  host.sound.bad();
  return false;
}
