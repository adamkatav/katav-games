# משחקי קלפים — Hebrew Solitaire

Klondike (סוליטר) and Spider (סוליטר עכביש) in Hebrew, built for an elderly player.
One self-contained HTML file (~190 KB), works offline, no install, no accounts.

## Running it

**Locally** — double-click `index.html`. That's it. Everything (code, card artwork,
sounds) is embedded in that one file, so it works with no internet connection and can be
copied anywhere on its own.

To put it on someone's desktop: right-click `index.html` → Send to → Desktop (create
shortcut), then rename the shortcut to `קלפים` and give it a card icon.

**On the web** — see "GitHub Pages" below.

## Design

[DESIGN.md](DESIGN.md) holds the game box's design principles — the rules that make these
games feel like one product, and the checklist for adding another one (Minesweeper,
Memory, FreeCell) so it arrives feeling like it came from the same box.

## Design decisions

These were deliberate, for an 80-something player on a Windows PC and a phone:

- **Tap-to-move, not drag.** Tap a card and it lights up gold; every legal destination
  pulses gold; tap one to move. Dragging still works for anyone who prefers it, but
  nothing *requires* holding a button down while aiming — that's the part that's hard
  with tremor or an unfamiliar mouse.
- **No failure states.** No timer pressure, no "you lost", unlimited undo, a hint button.
  The star rating at the end is generous on purpose.
- **Everything visible.** No hamburger menu, no icon-only buttons, no long-press, no
  right-click, no double-click requirement. Every action is a labelled button on screen.
- **Autosave.** Closing the window mid-game loses nothing; reopening offers "המשך משחק".
- **Fan spacing is fixed for the whole game.** It's computed from a typical worst-case
  column rather than the current board, so card spacing doesn't shift under you after
  every move. It compresses only as far as the rank in the corner stays fully readable;
  past that the board scrolls instead of clipping.
- **Red and black only**, big jumbo indices in *both* top corners so the rank is readable
  whichever way a column fans.

## The card art

`art/` holds the source PNGs, generated with Gemini from the prompts in
`ART-PROMPTS.md`. One figure per rank (J/Q/K) is shared across all four suits — exactly
how a real deck works, where only the index and pip change colour. The back is the Katav
family crest.

To change the artwork:

```powershell
powershell -ExecutionPolicy Bypass -File tools\slice-art.ps1    # only if re-cutting a 2x2 sheet
& "$env:USERPROFILE\.local\bin\uv.exe" run --with pillow python tools\optimize_art.py
powershell -ExecutionPolicy Bypass -File tools\embed-art.ps1    # re-embeds into index.html
```

`optimize_art.py` quantises the flat vector-style art to a small palette — it takes the
four PNGs from ~1.1 MB down to ~100 KB with no visible loss, which is what keeps the
single embedded file small.

## GitHub Pages

The repo lives at `git@github.com:adamkatav/katav-solitaire.git`.

To publish: in the repo on GitHub go to
**Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.

It goes live within a minute or two at:

**https://adamkatav.github.io/katav-solitaire/**

Pushing to `main` afterwards redeploys automatically.

`manifest.json` is already set up, so from that URL Chrome/Edge offers **Install app** —
which gives a real app icon and a full-screen window with no address bar or tabs. That's
worth doing; browser chrome is a common source of confusion.

## Commits and changelog

This repo uses [Conventional Commits](https://www.conventionalcommits.org/), with
[commitizen](https://commitizen-tools.github.io/commitizen/) run through `uvx` (no
install needed). Config lives in `.cz.toml`.

```powershell
uvx --from commitizen cz commit                  # interactive prompt-based commit
uvx --from commitizen cz check --rev-range HEAD~1..HEAD   # lint a message
uvx --from commitizen cz bump --yes              # bump version, update CHANGELOG.md, tag
uvx --from commitizen cz changelog               # regenerate the changelog
```

Common types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore`.
Scopes used here: `klondike`, `spider`, `score`, `input`, `layout`, `cards`, `anim`,
`hint`, `save`, `pwa`, `a11y`.

`cz bump` reads the commits since the last tag, works out the version increment and
prepends to `CHANGELOG.md` — so the changelog is only as good as the commit messages.

> **Windows gotcha:** don't write a commit-message file with
> `Set-Content -Encoding utf8` in Windows PowerShell 5.1 — it prepends a BOM and
> `cz check` then rejects even a valid message. Use
> `[IO.File]::WriteAllText($path, $msg, (New-Object Text.UTF8Encoding $false))`,
> or just pass `git commit -m`.

## Layout

```
index.html      the whole game — open this
manifest.json   lets browsers install it as an app
icon.svg        app icon
art/            source artwork (embedded into index.html, not loaded at runtime)
tools/          scripts to re-cut, compress and re-embed the artwork
ART-PROMPTS.md  the Gemini prompts used to generate the art
```
