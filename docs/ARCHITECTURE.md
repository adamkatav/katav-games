# Architecture

How the game box is built, and why. Design *rules* live in [DESIGN.md](DESIGN.md); this is
the code structure that enforces them.

**Stack:** TypeScript · Vite · vite-plugin-pwa · Vitest · Playwright. No UI framework.

---

## The problem this solves

v0.7.1 was one 1,700-line `index.html` with everything base64-embedded. That was the right
call for one game and survived three. It does not survive seven, and the failure mode was
already visible:

- **State drift.** Adding `bonus`, `peak`, `combo`, `fanCap` to the state object meant
  finding every construction site by hand. Missing one produced a silent wrong answer.
- **Branch-by-game.** `S.game === 'klondike' ? … : …` scattered through layout, rules,
  hints and rendering. Adding FreeCell meant auditing every one; a non-card game would
  mean auditing them again and getting a third of them wrong.
- **Scoring by convention.** "Score is derived, never accumulated" was a rule in a
  document. Nothing stopped the next `score += n`, and twice nothing did.

The rewrite makes those three things structural rather than remembered.

## The central idea: games describe, the engine decides

A game supplies **pure descriptions of itself**. It never owns the score, the undo stack,
the timer, the streak, the save file, or the win overlay.

```ts
export interface GameDef<S> {
  readonly id: GameId;
  readonly name: string;          // Hebrew, shown on the home card
  readonly emoji: string;
  readonly blurb: string;
  readonly difficulties?: readonly Difficulty[];
  readonly canUndo: boolean;      // false for Minesweeper: a reveal cannot be taken back
  readonly hasLoss: boolean;

  create(rng: Rng, difficulty?: DifficultyId): S;
  score(state: S): number;        // PURE and DERIVED — see below
  isWon(state: S): boolean;
  isLost?(state: S): boolean;
  hint(state: S): Hint | null;
  par(difficulty?: DifficultyId): { moves: number; time: number };

  createView(host: ViewHost<S>): GameView<S>;
}
```

**`score(state)` is a pure function of the board, and there is no score field a game can
reach.** That is the whole point: the two point-farming exploits we shipped become
unrepresentable, not merely forbidden. The engine calls `score()` after every commit,
diffs it against `peak`, and decides the streak.

### The commit seam

Views never mutate state directly. They go through the host:

```ts
export interface ViewHost<S> {
  readonly state: Readonly<S>;
  commit(mutate: (draft: S) => void, opts?: { undoable?: boolean; silent?: boolean }): void;
  toast(message: string): void;
  readonly sound: Sound;
  readonly settings: Settings;
}
```

One `commit` does all of it, in order, every time:

1. snapshot for undo (when `canUndo` and `undoable`)
2. apply the mutation
3. recompute `score()`, update `peak`, advance or break the streak, award bonus
4. bump the move counter, start the timer on first move
5. autosave
6. re-render
7. check win, then loss

Nothing is "remembered by the caller" any more. That list was previously spread across
`doMove`, `clickStock`, `handleClick` and `afterChange`, and the bugs lived in the gaps.

## Layout

```
src/
  main.ts                 boot: register SW, mount shell

  core/
    types.ts              GameDef, GameView, ViewHost, Hint, Difficulty
    engine.ts             Session: commit, undo, timer, win/loss, autosave
    score.ts              peak/streak/multiplier rules (shared by every game)
    rng.ts                seeded PRNG — a deal is reproducible from its seed
    storage.ts            saves, best scores, settings; all localStorage access

  ui/
    shell.ts              screen routing, keeps the toolbar/stats in sync
    home.ts               game cards, best scores, resume
    toolbar.ts            תפריט · ביטול · רמז · משחק חדש · הגדרות + game extras
    stats.ts              ניקוד · מהלכים · זמן · שיא · רצף + one game-specific slot
    overlays.ts           confirm · win · loss · difficulty · settings · help
    sound.ts              synthesised WebAudio; no audio files
    toast.ts  confetti.ts  stars.ts
    i18n.ts               EVERY Hebrew string, in one file

  games/
    registry.ts           the array the home screen renders; add a game here
    cards/
      deck.ts             Card, Suit, Rank, shuffling, deck builders
      piles.ts            pile ids, typed pile maps
      rules.ts            shared predicates: descending, alternating, sameSuit…
      art.ts              card face + back rendering
      layout.ts           the fan/compaction engine (see below)
      input.ts            tap-to-select / tap-to-place / optional drag
      view.ts             the shared card-board view every card game reuses
      klondike.ts  spider.ts  freecell.ts     ← just rules + score + hint
    minesweeper/
      generate.ts  solver.ts  def.ts  view.ts
    sudoku/
      generate.ts  solver.ts  rate.ts  def.ts  view.ts

  styles/
    tokens.css            colours, spacing, the one place felt/gold/navy are defined
    shell.css  cards.css  grid.css

art/        source PNGs (pipeline unchanged) — now hashed by Vite, not base64
tools/      the existing Python/PowerShell art pipeline
tests/      unit (Vitest) + e2e (Playwright)
```

`klondike.ts`, `spider.ts` and `freecell.ts` become **small** — rules, score, hint, par.
Everything else is `games/cards/`. That is the measure of whether this worked.

## Typed state

Each game owns its state type; the engine is generic over it. No shared "god" object.

```ts
type PileId = `t${number}` | `f${number}` | `e${number}` | `c${number}` | 'stock' | 'waste';

interface CardGameState {
  readonly piles: Readonly<Record<PileId, Card[]>>;
  hidden0: number;
}

interface MinesweeperState {
  readonly w: number; readonly h: number;
  mines: ReadonlySet<number>;
  revealed: Set<number>;
  flags: Set<number>;
  dead: number | null;          // index of the mine that ended it
}
```

Engine-owned fields (`score`, `bonus`, `peak`, `combo`, `moves`, `seed`) live in
`Session`, **not** in game state — which is why a game cannot drift them.

## Input

One module, `games/cards/input.ts` plus a grid equivalent, enforcing the rules from
DESIGN.md §2 so no game can quietly violate them:

- tap-to-select then tap-to-place is the only required interaction
- drag is offered as an optional accelerator
- a second action on the same piece is a **mode switch** in the toolbar
  (Minesweeper ⛏️/🚩, Sudoku ✏️/📝) — never right-click or long-press

## Layout engine

`games/cards/layout.ts` keeps the hard-won behaviour, now testable in isolation:

- geometry derived from the viewport, recomputed on resize
- fan spacing fixed for a whole round, from a typical worst case
- compression floor at the point the rank stops being readable
- **card size bounded by the deepest column, so the board never scrolls** — monotonic
  within a round so sizes tighten but never bounce

## PWA

`vite-plugin-pwa`, precaching the whole build (it is small). `registerType: 'autoUpdate'`
but **applied on next launch, never mid-game** — an update that reloads under a player is
exactly the kind of surprise this audience should not get.

Assets stop being base64. Vite hashes them, the service worker precaches them, and
offline still works — with a much smaller HTML document and proper caching.

## Testing

Split by what each tool is actually good at:

**Vitest** — pure logic, milliseconds, the bulk of the suite:
- placement rules for every card game
- `score()` is derived: *for any move sequence returning to the same board, the score is
  equal* — the exploit, stated as a property
- streak: builds on progress, survives neutral moves, breaks on regression and on hints
- **Sudoku**: every generated puzzle has exactly one solution, and its rating matches the
  techniques actually required
- **Minesweeper**: every generated board is solvable by logic alone, and the first click
  is always safe — run over hundreds of seeds, which is only affordable headless

**Playwright** — the handful of things that need a real DOM:
- a long column compacts instead of scrolling, at several viewport sizes
- tap-to-select then tap-to-place completes a move
- the app installs as a PWA and starts offline

Seeded RNG means a failing board is reproducible from its seed instead of being a
heisenbug.

## CI

`build → typecheck → vitest → playwright → deploy to Pages`. Deploy only on green.

## Adding a game

1. `src/games/<name>/def.ts` implementing `GameDef`.
2. A view — reuse `games/cards/view.ts` for a card game, or write a grid view.
3. Register it in `games/registry.ts`.
4. Hebrew strings into `ui/i18n.ts`.
5. Unit-test the rules and, if it generates boards, the fairness property.

The shell, scoring, streak, undo, autosave, timer, stars, best scores, settings, sounds
and win/loss overlays come for free. If a game needs to touch any of those directly, the
seam is wrong — fix the seam.
