# Game box — design principles

The rules that make these games feel like one product. A new game that follows this list
will feel like it came from the same box.

Written for one player: an elderly Hebrew speaker, head of the Katav family, playing on a
Windows PC and a phone. **Every rule below traces back to that.** Where a rule and a
convention disagree, the player wins.

### Words used here

Deliberately game-agnostic, so the rules survive contact with a game that isn't cards:

- **piece** — a card, a tile, a cell, a peg.
- **board** — the playing surface.
- **round** — one play, start to finish.
- **mark** — the thing that identifies a piece at a glance: a card's rank, a cell's mine
  count, a tile's number.

---

## 1. Identity

- **One table.** Deep green felt (`#1d7a52` → `#0f5236` radial), cream-white pieces, gold
  (`#ffc531` / `#d4af37`) for anything that says "well done", navy `#16255c` for the back
  of anything face-down, covered or unrevealed.
- **The Katav crest is the signature.** It is on every card back, it is the reward when a
  column clears, it is the app icon. A new game should find an honest place for it — the
  back of a tile, the face of an unrevealed cell — not bolt it on.
- **Red and black** for classic suit-like content; the gold/navy pair for everything
  structural. No novelty palettes.
- **Serif inside the artwork, system sans for the UI.** `Georgia` on the pieces,
  `Segoe UI / Noto Sans Hebrew / Arial` for chrome. Never a downloaded font.
- **Hebrew first.** RTL throughout, with board direction itself a setting.

## 2. Input — the rule that matters most

- **Tap to select, tap to act.** Two unambiguous steps. The selected thing glows gold.
- **Never *require* drag, double-click, right-click, long-press, or any gesture.** These
  are hard with tremor, arthritis, a trackpad, or an unfamiliar mouse.
- **Accelerators are always optional.** Drag works. Double-click sends a card to its
  foundation. Neither is ever the only way to do something.
- **When a game needs two different actions on the same piece, use a visible mode
  switch** — two big labelled buttons, one of them lit — never a modifier key, a second
  mouse button, or a long-press. This is the single most common place a classic game
  design will violate the rules above; solve it with a switch every time.
- **Big targets.** Nothing interactive below roughly 44px; button text 18–21px.
- **No hidden UI.** No hamburger menus, no icon-only buttons, no swipe-to-reveal. Every
  action is a labelled button visible on screen. An icon may accompany a word, never
  replace it.

## 3. Losing

**Losing is allowed when losing is the game.** Minesweeper without a mine that ends the
round is not Minesweeper. Do not design the challenge out of a game to make it gentle —
that produces something toothless and slightly insulting.

What is forbidden is losing *unfairly* or *inexplicably*:

- **A loss must always be attributable to a decision the player could have made better.**
  If the genre allows positions where the player can only guess, fix the generator, not
  the player's expectations. For Minesweeper that means a guaranteed-safe first click and
  boards that are solvable by logic alone.
- **A loss must be legible.** Show what happened and why — reveal the board, mark the
  piece that ended it. Never a bare "you lost".
- **A loss ends the round, never anything else.** Settings, best scores and the other
  games are untouched. Nothing the player did not choose to risk is ever taken.
- **The way back in is immediate and dignified**: 🔄 עוד משחק sitting right there, and a
  return to the menu beside it.
- **The tone is warm, never mocking.** "הפעם לא הסתדר" — not "אתם הפסדתם".
- **Score what was achieved.** A lost round still shows what the player built before it
  ended. A loss screen is the win screen's calmer sibling: same shape, same buttons, no
  confetti, no stars.

And everything that is *not* the game's core challenge stays soft:

- **No countdown that kills, no move limit, no score that goes negative.** Timers count
  up and are informational.
- **Unlimited undo** wherever the concept permits it, restoring everything including
  score and streak. Where it doesn't — a revealed mine cannot be un-revealed without
  removing the game — say so by not offering the button, rather than offering one that
  lies.
- **A hint button is always present,** and always gives a genuinely useful move, not
  merely a legal one.
- **Confirm only what destroys.** "משחק חדש" mid-round asks once. Everything else is
  instant.
- **Rewards skew generous.** Five stars should feel reachable.

## 4. Difficulty

- **Easiest first, and marked** "מומלץ להתחלה".
- **Difficulty changes the board, never the punishment.** More mines, more suits, a bigger
  grid — not a tighter clock or fewer undos.
- **Best scores are kept per difficulty**, so an easy game is never competing with a hard
  one.

## 5. Scoring — derived, never accumulated

Learned the hard way; non-negotiable, because it prevents a whole class of bug by
construction rather than patching instances.

- **Score is a pure function of the board.** Never `score += n` per action. If a sequence
  of moves returns the board to the same position, the score must return to the same
  number.
  - Solitaire: pieces revealed, pieces finished, same-suit pairs, completed sets.
  - Minesweeper: cells correctly revealed and mines correctly flagged — *not* clicks made.
- **Bonuses pay only on progress beyond the best position reached so far** (`peak`).
  Otherwise a streak multiplier re-opens the exploit one level up.
- **Streaks break only on a move that undoes progress, or on asking for help.** Neutral
  setup moves neither build nor break them — most good play is setup, and punishing it
  feels arbitrary.
- **Multipliers**: ×1.5 → ×2 → ×2.5 → ×3 → ×4, shown as a pulsing gold badge.

## 6. Feedback

- **Every sound is synthesised in code** via WebAudio. No audio files, ever — it is what
  keeps a game one offline file.
- **Pitch encodes magnitude.** The streak arpeggio rises with the multiplier; losing it
  falls. The player should be able to hear how it is going without looking.
- **Motion explains state,** it does not decorate. Pieces travel to where they went,
  covers flip in 3D, a thing that scored pulses.
- **Timings:** moves ~0.26s, flips ~0.38s, celebrations ~1.5s, win sequence ~4s.
- **Reward in proportion.** A floating `+15` for points; the crest ceremony for a big
  structural achievement; confetti and stars only for winning a round.
- **Sound is a setting, and it is remembered.**

## 7. Layout

- **Computed in JS from the viewport**, never fixed pixels, recomputed on resize.
- **Geometry stays put during a round.** Sizing is derived from a typical worst case, not
  the live board, so pieces do not shift under the player after every move.
- **Legibility sets the floor.** Compress only until the mark is still fully readable;
  past that, scroll instead.
- **Centre the board and expand into spare height** rather than stranding everything at
  the top of a tall phone screen.
- **Fit the width; never scroll horizontally** by default. Bigger pieces are an opt-in
  setting that may scroll.

## 8. Settings

Few, concrete, each a row of big labelled buttons — never a dropdown or a toggle switch.
Reuse these verbatim wherever they apply, and add game-specific ones in the same shape:

| Setting | Options | Default |
|---|---|---|
| סימון מקומות אפשריים | כבוי / מופעל | כבוי |
| גודל הקלפים | רגיל / גדול / ענק | רגיל |
| כיוון הלוח | מימין לשמאל / משמאל לימין | מימין לשמאל |
| צלילים | פועלים / כבויים | פועלים |

**Defaults are chosen for the player, not the power user** — hints off, easiest
difficulty first, draw-one.

## 9. Shared shell

Every game presents the same furniture, in the same places, with the same words:

- **Home**: one large card per game — emoji, name, one-line description, personal best.
  Plus "המשך משחק" when a save exists, and ❓ איך משחקים / ⚙️ הגדרות. Version and byline
  small in the bottom-left corner.
- **Difficulty** chosen in an overlay after picking the game.
- **Toolbar**: 🏠 תפריט · ↩️ ביטול · 💡 רמז · 🔄 משחק חדש · ⚙️ — plus at most one or two
  game-specific buttons (solitaire adds ⬆️ אסוף הכל; a game needing a second action adds
  its mode switch here).
- **Stats bar**: ניקוד · מהלכים · זמן, plus one game-specific counter, plus the רצף badge.
- **Win**: 🎉 כל הכבוד! → stars animate in one by one → score → שיא חדש if beaten → moves
  and time → 🔄 עוד משחק / 🏠 תפריט, with confetti over the top.
- **Loss** (only where the game has one): same panel, calmer — what happened, the score
  reached, 🔄 עוד משחק / 🏠 תפריט. No confetti, no stars.
- **Help** is written as instructions to a person, in short sentences.

### Shared vocabulary

Use these exact words so nothing has two names:

תפריט · ביטול · רמז · משחק חדש · הגדרות · ניקוד · מהלכים · זמן · רצף · שיא ·
כל הכבוד! · הפעם לא הסתדר · עוד משחק · המשך משחק · איך משחקים ·
קל / בינוני / קשה · מומלץ להתחלה

## 10. Technical rules that protect the feel

- **One self-contained `.html` per game.** All code, artwork and sound embedded; opens
  offline from a double-click and can be copied anywhere on its own.
- **No CDN, no external fonts, no runtime dependencies.** Nothing that can fail on a slow
  or absent connection.
- **Artwork is embedded base64 and quantised first.** Flat vector-style art drops ~10× to
  a small palette with no visible loss; that is what keeps a single file under ~250 KB.
- **Autosave to `localStorage` after every change**, keyed `hslt_save_<game>`, with
  `hslt_best_<game><difficulty>`. Closing mid-round loses nothing; resuming asks nothing.
- **Fail safe, never freeze.** The player is alone, with no console and no way to recover.
  A guard that prevents a wedged board is always worth its line.
- **Version on screen, wired to the release.** `APP_VERSION` is listed in `.cz.toml`'s
  `version_files`, so it can never drift from the tag.
- **Ship as a PWA too** — installed, it loses the address bar and tabs, which is a real
  source of confusion.

---

## Worked example — Minesweeper

How the rules land on a game whose core mechanic is losing:

| Rule | What it means here |
|---|---|
| Two actions, one piece | Reveal and flag are a **visible mode switch** in the toolbar — ⛏️ חשיפה / 🚩 דגל, the active one lit. Never right-click, never long-press. |
| Losing is allowed | Hitting a mine ends the round. Do not soften it. |
| Losing must be fair | **First click is always safe**, and boards are generated so they are solvable by logic alone — never a forced guess. |
| Losing must be legible | Reveal the whole board, mark the mine that ended it in red and any mis-placed flags. |
| Loss costs only the round | Best scores and settings untouched; 🔄 עוד משחק right there. |
| Score is derived | Cells correctly revealed + mines correctly flagged. Flagging and unflagging the same cell repeatedly earns nothing. |
| Streak | Rises with each safe deduction; broken by a hint, not by a slow or cautious move. |
| Undo | Only where honest. Revealing is not undoable without removing the game, so no undo button during a round — but a mis-placed flag is. |
| Hint | Points at a cell that can be resolved by logic right now, so it teaches rather than just rescues. |
| Difficulty | קל / בינוני / קשה change grid size and mine count, nothing else. |
| Identity | Unrevealed cells are navy with the crest; revealed numbers use the same red/black; the flag is gold. |
| Layout | Grid computed from the viewport, cell size floored where the number stays readable, board centred. |
| Sound | Rising pitch as a cascade opens; a soft low tone for a flag; the round-ending sound is sombre, not comic. |

---

## Adding a game — the checklist

1. Home-screen card: emoji, Hebrew name, one-line description, best score.
2. Difficulty overlay, easiest first and recommended; difficulty changes the board only.
3. Standard toolbar and stats bar, same words. Any second action is a visible mode switch.
4. Score derived from board state; bonus gated on `peak`; streak breaks only on
   regression or hint.
5. Tap to select, tap to act; every accelerator optional.
6. Synthesised sounds, pitch carrying meaning.
7. Undo everything the concept honestly allows — and no button where it doesn't.
8. Autosave and resume.
9. Win overlay with stars and confetti; a calmer loss overlay if the game can be lost,
   always showing what happened and what was scored.
10. If the game can be lost, make sure every loss is attributable to a decision.
11. Layout computed from the viewport, stable during play, legibility as the floor.
12. Find an honest place for the crest.
13. One file, embedded assets, works offline, version on screen.
