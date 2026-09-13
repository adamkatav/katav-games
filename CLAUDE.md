# Working on katav-games

Read this before changing anything. It records the decisions that look odd from
outside, and the traps this repo has already fallen into — several of them twice.

**Who it is for.** One player: an elderly Hebrew speaker, head of the Katav family,
on a Windows PC and a phone. That is the whole design brief. When a rule here and a
convention disagree, the player wins.

- [docs/DESIGN.md](docs/DESIGN.md) — the product rules, with reasoning attached
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the engine seam
- [docs/GAMES.md](docs/GAMES.md) — roadmap and generation algorithms

---

## Commands

```bash
npm run dev          # dev server
npm run build        # typecheck + build
npm test             # unit (Vitest) — ~3s
npm run test:e2e     # browser (Playwright), desktop + phone
npm run typecheck
```

`tsc` runs with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
Optional properties need conditional spreads (`...(x !== undefined ? { x } : {})`),
not `x: undefined`.

## The one rule that shapes everything

**A game describes itself; the engine decides.** A `GameDef` supplies pure
`create` / `score` / `isWon` / `hint` / `par` plus a view. It never owns the score,
the undo stack, the timer, the streak, the save file or the win decision.

`score(state)` is the **only** way to produce a score, and there is no score field a
game can write. That is deliberate: two point-farming exploits shipped before this
seam existed, and it makes them unrepresentable rather than merely forbidden.

Everything a move must do happens in one `commit()`: snapshot for undo, mutate,
recompute the derived score, advance or break the streak, count the move, autosave,
render, then check win and loss. Never do any of that by hand — the bugs used to
live in the gaps between those steps.

### Scoring invariants

- The base score is a pure function of state. The same position always scores the same.
- Bonuses pay only on progress beyond `peak`, never on a per-move delta. Without
  that, a streak multiplier re-opens the exploit one level up.
- A streak breaks only on a move that **undoes** progress, or on a hint. Neutral
  setup moves neither build nor break it — most good play is setup.
- 2048 looks like an exception and is not: its accumulator lives in *state*, so
  `score(state)` is still pure. The invariant is about state, not the visible board.

### State must be JSON-serialisable

Undo and autosave go through `JSON.stringify`. **No `Set`, no `Map`, no class
instances** in game state — a `Set` serialises to `{}` and silently loses the board
on resume. Convert at the boundary instead.

### Randomness must be reproducible

Anything random mid-game derives from a seed in state (`seed` + a counter), never a
fresh `Math.random()`. Otherwise undo replays a different board. Minesweeper
generates from `(seed, firstClick)`; 2048 spawns from `(seed, spawns)`.

## Input rules

- **Tap to select, tap to act** is the only interaction that may ever be required.
- Drag, double-click, right-click, long-press, swipe and keys are **accelerators
  only**. Never the sole path to anything.
- Two actions on one piece means a **visible mode switch** in the toolbar
  (Minesweeper ⛏️/🚩, Sudoku ✏️/📝), never a modifier or a second mouse button.
- A refused move must **say why**, in Hebrew. Silent refusal is the single most
  confusing thing for this player.

## Layout rules

- Geometry is computed from the viewport, never fixed pixels.
- **The board must never scroll.** Pieces shrink instead. This regressed twice.
- Spacing is derived from a typical worst case, not the live board, so it does not
  shift under the player after every move.
- Compression stops where the identifying mark (a card's rank, a cell's number) is
  still fully readable.
- **The home screen must never scroll**, at any size. There is a test.

## Traps this repo has already hit

Each of these shipped. Do not re-learn them.

1. **A test that bypasses the real entry point tests nothing.** Two bugs hid for
   weeks behind unit tests that called a tap handler directly and so never
   exercised the DOM event path. Empty slots turned out to be unreachable by click
   entirely. **Drive real clicks in e2e.**
2. **The engine only calls `render()` after a move, never `layout()`.** If a size
   depends on board contents, recompute it inside `render`. Forgetting this is what
   made the board start scrolling again after the rewrite.
3. **Measure only after the element is visible and its siblings are built.**
   Mounting a board while its section is `hidden` reads a width of zero; mounting
   before the toolbar is rendered sizes it against a host about to get shorter.
4. **`ResizeObserver` feedback.** Resizing the board toggles the host scrollbar,
   which resizes the host, which refires the observer. Coalesce into one frame.
5. **The design is light-only and must declare it.** Without `color-scheme: light`,
   Android Chrome and Samsung Internet re-tint the felt and flatten the colours
   that carry meaning.
6. **Hints carry messages.** For Sudoku, Minesweeper and 2048 the message *is* the
   hint. Surface it for every hint kind, not just some.
7. **A hint must never reason from what the player believes.** Minesweeper's
   solver treats a flag as a known mine, so one misplaced flag made it hand out
   "safe" cells that were live mines; Sudoku's hint took a wrong digit as given
   and suggested digits that could not be right. Both now check the player's
   input against the truth first and point at the mistake instead. A hint that
   can get the player killed breaks the only promise these games make.
8. **A refusal must explain *itself*, not recite the nearest rule.** Dropping a
   card on the deck used to answer "put it on a card one bigger in the opposite
   colour". A wrong reason is worse than none — it sends the player looking for
   something that isn't there.

## Where an action lives

Each game's action is one exported function, and the view calls it rather than
owning it: `cards/moves.ts` (`performMove`, `attemptMove`), `g2048/def.ts`
(`performMove`), `sudoku/def.ts` (`placeDigit`), and the grid games' `onCell`.

That is what lets `tests/unit/*.scenarios.test.ts` drive the shipped code
headlessly — a position, one action, and the whole board afterwards. It does not
replace trap 1: dispatching the event is still the browser suite's job.

## Windows gotchas

Both of these cost real time here.

- **Never** round-trip a file with `Get-Content | Set-Content` in PowerShell 5.1 —
  it mangles Hebrew and emoji into mojibake. Use
  `[IO.File]::WriteAllText($p, $s, (New-Object Text.UTF8Encoding $false))`.
- **Never** put double quotes in `git commit -m` on Windows; they break argv
  splitting. Write a BOM-less message file and use `git commit -F`. A BOM also makes
  `cz check` reject an otherwise valid message.
- `git`, `node` and `gh` may not be on a session's PATH if they were installed after
  it started. Prepend `C:\Program Files\Git\cmd` and `C:\Program Files\nodejs`.

## Commits

Conventional Commits via `uvx --from commitizen cz bump --yes`, which also rewrites
the version in `package.json` — `vite.config.ts` reads it to define
`__APP_VERSION__`, so the version on screen cannot drift from the tag.

**Stage each commit's files individually.** Running `git add -A` and then writing two
messages silently puts everything in the first commit and leaves the second empty.
That happened twice; both times the changelog had to be corrected by hand.

## Adding a game

1. `src/games/<name>/def.ts` implementing `GameDef` (or `GridSpec` / `CardSpec`).
2. Reuse `games/cards/view.ts` or `games/grid/model.ts` for the board.
3. One line in `games/registry.ts`.
4. Hebrew strings into `ui/i18n.ts`; help text into the registry's `HELP_HTML`.
5. Unit-test the rules, and the fairness property if it generates boards
   (solvable without guessing; exactly one solution).
6. Add a scenario table — position, action, whole board afterwards — covering
   every state the game can be in on its hardest setting, refusals included.
7. Update the home-lists-every-game e2e expectation.

If a game needs to reach past the seam into the score, undo or timer, the seam is
wrong — fix the seam.

## Known open items

- Minesweeper Expert (30×16) generation takes ~200ms, because proving a board needs
  no guessing means solving many candidates. Acceptable once per round; the clearest
  candidate for moving into a Web Worker if it ever grates.
- Expert scrolls sideways on a phone — the honest cost of the real board size.
- Updates apply on next launch (`skipWaiting: false`), which is right for the player
  but means a browser tab you keep reloading may sit on an old build. An
  "update available" prompt has been offered but not built.
- The home screen offers only the first suspended round it finds. A second one is
  still on disk and still resumable by starting that game, but nothing points at it.
- `T.stuckTitle` / `T.stuckBody` are written but never shown: a card game with no
  move left just says "אין מהלך זמין" through the hint button.
