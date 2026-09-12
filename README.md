# משחקי קלפים — Katav game box

Hebrew card games built for one player: an elderly speaker, head of the Katav family, on
a Windows PC and a phone. Currently Klondike (סוליטר) and Spider (סוליטר עכביש), in one
self-contained HTML file that works offline.

**▶ Play: <https://adamkatav.github.io/katav-solitaire/>**

---

## Running it

**Locally** — double-click `index.html`. Everything (code, artwork, sounds) is embedded in
that one file, so it works with no internet and can be copied anywhere on its own.

To put it on someone's desktop: right-click `index.html` → Send to → Desktop (create
shortcut), rename it `קלפים`, and give it the crest icon.

**Installed** — open the URL above in Edge or Chrome and choose **Install app**. That gives
a real desktop icon and a full-screen window with no address bar or tabs, which is worth
doing: browser chrome is a common source of confusion.

## Repository layout

```
index.html              the whole game — open this
manifest.json           lets browsers install it as an app
icon.svg                app icon (generated from the crest)

docs/
  DESIGN.md             design principles for the game box — read before adding a game
  GAMES.md              roadmap: Minesweeper and Sudoku generation, plus what else fits
  CHANGELOG.md          maintained by commitizen
  ART-PROMPTS.md        the image prompts the card art was generated from

art/                    source artwork, embedded into index.html (not loaded at runtime)
  source/               the original generated sheet, kept for re-cutting

tools/                  re-cut, compress and re-embed the artwork; build the icon
tests/                  browser test suite + headless CI runner
.github/workflows/      runs the suite on every push
```

## Tests

Open **`tests/run.html`** in any browser. No tooling, no install — it loads the game in an
iframe and prints a pass/fail list. The page title becomes `PASS (n)` or `FAIL (n)`.

The same suite runs headlessly in CI on every push (`.github/workflows/tests.yml`). To run
it that way locally you need Node:

```bash
npm install --no-save playwright && npx playwright install chromium
python -m http.server 8791          # in another terminal
node tests/ci.js
```

Tests reach the game through a seam exposed only when the page is loaded with `?test=1`,
so the normal game carries no debug surface.

## Artwork

`art/` holds the source PNGs, generated with Gemini from the prompts in
[docs/ART-PROMPTS.md](docs/ART-PROMPTS.md). One court figure per rank is shared across all
four suits — exactly how a real deck works, where only the index and pip change colour.
The back is the Katav family crest.

To change the artwork:

```powershell
powershell -ExecutionPolicy Bypass -File tools\slice-art.ps1     # re-cut the 2x2 sheet
uv run --with pillow python tools\rebuild_back.py                # centre the card back
uv run --with pillow python tools\extract_crest.py               # crest for effects
uv run --with pillow python tools\make_icon.py                   # app icon
uv run --with pillow python tools\optimize_art.py                # quantise
powershell -ExecutionPolicy Bypass -File tools\embed-art.ps1     # embed into index.html
```

`optimize_art.py` matters: it quantises the flat vector-style art to a small palette,
taking the assets from ~1.1 MB to ~100 KB with no visible loss. That is what keeps the
single embedded file small.

## Commits and changelog

[Conventional Commits](https://www.conventionalcommits.org/), with
[commitizen](https://commitizen-tools.github.io/commitizen/) via `uvx`. Config in
`.cz.toml`.

```powershell
uvx --from commitizen cz commit      # interactive
uvx --from commitizen cz bump --yes  # bump version, update changelog, tag
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore`.
Scopes: `klondike`, `spider`, `score`, `input`, `layout`, `cards`, `anim`, `hint`, `save`,
`pwa`, `a11y`, `ui`, `game`.

`cz bump` also rewrites `APP_VERSION` in `index.html` (via `version_files`), so the version
shown on screen can never drift from the tag.

> **Windows gotcha:** don't write a commit-message file with `Set-Content -Encoding utf8`
> in PowerShell 5.1 — it prepends a BOM and `cz check` then rejects even a valid message.
> Use `[IO.File]::WriteAllText($p, $msg, (New-Object Text.UTF8Encoding $false))`, and avoid
> double quotes in `git commit -m` on Windows, where they break argv splitting.

## Adding a game

Read [docs/DESIGN.md](docs/DESIGN.md) first — it is the rules that make these feel like one
product, with the reasoning attached so the deliberate-looking oddities don't get undone.
[docs/GAMES.md](docs/GAMES.md) has the roadmap and the generation algorithms for the next
two.
