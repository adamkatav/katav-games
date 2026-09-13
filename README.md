# משחקי קלפים — the Katav game box

Hebrew games built for one player: an elderly speaker, head of the Katav family, on a
Windows PC and a phone. Six games so far — Klondike, FreeCell, Spider, Minesweeper,
Sudoku and 2048 — sharing one shell, one scoring engine and one visual language.

**▶ Play: <https://adamkatav.github.io/katav-games/>**

Installable as a PWA, works offline, no accounts, no ads, no network calls.

---

## Getting started

```bash
npm install
npm run dev        # dev server with hot reload
npm run build      # typecheck + production build into dist/
npm test           # unit tests (fast)
npm run test:e2e   # browser tests on desktop and phone viewports
```

Requires Node 20+. Nothing else: no global installs, no database, no services.

## Installing it for someone

Open the URL above in Edge or Chrome and choose **Install app**. That gives a real desktop
icon and a full-screen window with no address bar and no tabs — worth doing, because
browser chrome is a common source of confusion for the player this is built for.

A new version is picked up on the **next launch**, never by reloading mid-game.

## Layout

```
src/
  core/         the engine: commit, undo, derived score, streak, timer, saves
    types.ts      GameDef, GameView, ViewHost — the contract every game implements
    engine.ts     Session: the one place a move is applied
    score.ts      peak/streak/multiplier rules, shared by every game
    rng.ts        seeded PRNG — every deal is reproducible from its seed
  ui/           shell, overlays, synthesised sound, Hebrew strings (i18n.ts)
  games/
    cards/        deck, rules, art, layout, the shared card board
      klondike.ts  freecell.ts  spider.ts      ← rules only
    grid/         cell geometry and the shared grid board
    minesweeper/  solver.ts  generate.ts  def.ts
    sudoku/       solver.ts  generate.ts  def.ts
    g2048/        logic.ts  def.ts
  styles/

art/            source PNGs, hashed and precached at build time
tools/          re-cut, compress and re-embed the artwork; build the icon
tests/unit/     rules, scoring invariants, generators — milliseconds
  scenarios/      the state → action → state harness each game's table runs on
tests/e2e/      layout, real input, service worker — Playwright
docs/           ARCHITECTURE · DESIGN · GAMES · CHANGELOG · ART-PROMPTS
legacy/         the original single-file version, kept for reference
```

## Before you change anything

[CLAUDE.md](CLAUDE.md) is the working brief: the engine seam, the rules that keep the
games feeling like one product, and the traps this repo has already fallen into —
several of them twice. It is short and worth reading first.

## How a game is put together

A game supplies a `GameDef`: `create`, `score`, `isWon`, `hint`, `par`, plus a view. It
never owns the score, the undo stack, the timer, the streak, the save file or the win
decision — the engine does. Because `score(state)` is the only way to produce a score,
point-farming exploits are unrepresentable rather than merely forbidden.

Adding a game means writing a def, reusing `games/cards/view.ts` or `games/grid/model.ts`,
and adding one line to `games/registry.ts`. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the seam and [docs/DESIGN.md](docs/DESIGN.md) for the rules that keep the games feeling
like one product — the reasoning is attached so the deliberate-looking choices don't get
undone by accident.

## Tests

Split by what each tool is good at:

- **Vitest** — rules, scoring invariants, streak behaviour, and the generators. The
  Minesweeper generator is checked for being solvable by logic alone with a guaranteed-safe
  first click; the Sudoku generator for having exactly one solution. Both are properties,
  run over many seeds, and finish in about a second.
- **Scenario tables** (`tests/unit/*.scenarios.test.ts`) — each game on its hardest
  setting, written as a position, one action, and the whole board afterwards. Cards are
  written out as `{ t0: 'KS QH ?7D' }`, Minesweeper as a picture that carries both what
  the player sees and what is under the board, Sudoku and 2048 as grids. Every position
  is rendered back and compared before the action runs, so a case that describes an
  impossible board fails rather than quietly testing something else.
- **Playwright** — layout that must not scroll, real clicks, the PWA. Desktop and phone.

Tests reach the app through `window.__shell`, which is read-only and grants nothing a
player lacks. **Drive real clicks where you can:** two shipped bugs hid behind tests that
called a handler directly and so never exercised the DOM path.

## Artwork

`art/` holds source PNGs generated with Gemini from the prompts in
[docs/ART-PROMPTS.md](docs/ART-PROMPTS.md). One court figure per rank is shared across all
four suits — as in a real deck, where only the index and pip change colour. The back is the
Katav family crest.

To regenerate after changing the art:

```powershell
powershell -ExecutionPolicy Bypass -File tools\slice-art.ps1   # re-cut a 2x2 sheet
uv run --with pillow python tools\rebuild_back.py              # centre the card back
uv run --with pillow python tools\extract_crest.py             # crest for effects
uv run --with pillow python tools\make_icon.py                 # app icon
uv run --with pillow python tools\optimize_art.py              # quantise
```

`optimize_art.py` earns its place: it takes the assets from ~1.1 MB to ~100 KB with no
visible loss, because flat vector-style art quantises extremely well.

## Commits and releases

[Conventional Commits](https://www.conventionalcommits.org/) with
[commitizen](https://commitizen-tools.github.io/commitizen/) via `uvx`; config in `.cz.toml`.

```powershell
uvx --from commitizen cz bump --yes   # bump, update docs/CHANGELOG.md, tag
```

`cz bump` rewrites the version in `package.json`, which `vite.config.ts` reads to define
`__APP_VERSION__` — so the version shown on screen cannot drift from the tag.

CI typechecks, unit-tests, builds, runs the browser tests, and deploys to Pages **only on
green**.

> **Windows gotchas, both of which cost real time here:**
> - Don't round-trip a file with `Get-Content | Set-Content` in PowerShell 5.1 — it mangles
>   Hebrew and emoji into mojibake. Use `[IO.File]::WriteAllText($p, $s, (New-Object Text.UTF8Encoding $false))`.
> - Don't put double quotes in `git commit -m` on Windows; they break argv splitting. Write
>   the message to a BOM-less file and use `git commit -F`.
