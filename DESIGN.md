# Game box — design principles

The rules that make these games feel like one product. A new game (Minesweeper,
Memory, FreeCell…) that follows this list will feel like it came from the same box.

Written for one player: an elderly Hebrew speaker, head of the Katav family, playing on
a Windows PC and a phone. **Every rule below traces back to that.** When a rule and a
convention disagree, the player wins.

---

## 1. Identity

- **One table.** Deep green felt (`#1d7a52` → `#0f5236` radial), cream-white pieces, gold
  (`#ffc531` / `#d4af37`) for anything that says "well done". Navy `#16255c` for backs
  and covers.
- **The Katav crest is the signature.** It appears on every card back, as the reward
  animation when a column clears, and as the app icon. A new game should find its own
  honest place for it — the back of a tile, the cover of a closed cell — not bolt it on.
- **Red and black only** for classic suit-like content. No four-colour decks, no novelty
  palettes.
- **Serif for the artwork, system sans for the UI.** `Georgia` inside the pieces,
  `Segoe UI / Noto Sans Hebrew / Arial` for chrome. Never a downloaded font.
- **Hebrew first.** RTL throughout, board direction itself a setting.

## 2. Input — the rule that matters most

- **Tap to select, tap to act.** Two unambiguous steps. The selected thing glows gold.
- **Never *require* drag, double-click, right-click, long-press, or any gesture.** These
  are hard with tremor, arthritis, a trackpad, or an unfamiliar mouse.
- **Accelerators are always optional.** Drag works. Double-click sends a card to its
  foundation. Neither is ever the only way to do something.
- **Big targets.** Nothing interactive smaller than roughly 44px; buttons 18–21px text.
- **No hidden UI.** No hamburger menus, no icon-only buttons, no swipe-to-reveal. Every
  action is a labelled button visible on screen. An icon may accompany a word, never
  replace it.

## 3. No failure states

- **Nothing punishes.** No countdown, no "you lost", no score that can go negative, no
  move limit. The timer counts up and is informational.
- **Unlimited undo**, restoring everything including score and streak.
- **A hint button is always present**, and always gives a genuinely useful move — not
  merely a legal one.
- **Confirm only what destroys.** "משחק חדש" mid-game asks once. Everything else is
  instant and undoable.
- **Rewards skew generous.** Five stars should feel reachable.
- **This is the interesting constraint for a game like Minesweeper**, which is built
  around losing. Don't port the loss: make the mine click undoable (or never fatal on the
  first click), and let the player continue. A game in this box may be *lost as a round*,
  never *taken away mid-thought*.

## 4. Scoring — derived, never accumulated

Learned the hard way; this one is non-negotiable because it prevents a whole class of bug.

- **Score is a pure function of the board.** Never `score += n` per action. If a sequence
  of moves returns the board to the same position, the score must return to the same
  number. This kills point-farming by construction instead of patching each exploit.
  - Solitaire: cards revealed, cards on foundations, same-suit pairs, completed sets.
  - Minesweeper would be: cells correctly revealed and mines correctly flagged — *not*
    clicks made.
- **Bonuses pay only on progress beyond the best position reached so far** (`peak`).
  Otherwise a streak multiplier just re-opens the exploit one level up.
- **Streaks break only on a move that undoes progress, or on asking for help.** Neutral
  setup moves neither build nor break them — most good play in these games is setup, and
  punishing it feels arbitrary.
- **Multipliers**: ×1.5 → ×2 → ×2.5 → ×3 → ×4, shown as a pulsing gold badge.

## 5. Feedback

- **Every sound is synthesised in code** via WebAudio. No audio files, ever — it keeps the
  game one offline file.
- **Pitch encodes magnitude.** The streak arpeggio rises with the multiplier; losing it
  falls. A player should be able to hear how well they're doing without looking.
- **Motion explains state,** it doesn't decorate. Pieces travel to where they went; covers
  flip in 3D; a thing that scored pulses.
- **Timings:** moves ~0.26s, flips ~0.38s, celebrations ~1.5s, win sequence ~4s.
- **Reward in proportion.** A floating `+15` for points; the crest ceremony for a big
  structural win; confetti and stars only for winning.
- **Sound is a setting and it is remembered.**

## 6. Layout

- **Computed in JS from the viewport**, never fixed pixels. Board geometry is recomputed
  on resize.
- **Geometry stays put during a game.** Spacing is derived from a typical worst case, not
  the live board, so the pieces don't shift under the player after every move.
- **Legibility sets the floor.** Layout compresses only until the identifying mark (a
  card's rank, a cell's number) is still fully readable; past that, scroll instead.
- **Centre the board, and expand into spare height** rather than stranding everything at
  the top of a tall phone screen.
- **Fit the width, never scroll horizontally** by default. Bigger pieces are an opt-in
  setting that may scroll.

## 7. Settings

Few, concrete, and each a row of big labelled buttons — never a dropdown or a toggle
switch. Current set, which a new game should reuse verbatim where it applies:

| Setting | Options | Default |
|---|---|---|
| סימון מקומות אפשריים | כבוי / מופעל | כבוי |
| גודל הקלפים | רגיל / גדול / ענק | רגיל |
| כיוון הלוח | מימין לשמאל / משמאל לימין | מימין לשמאל |
| צלילים | פועלים / כבויים | פועלים |

**Defaults are chosen for the player, not for the power user** — hints off, easiest
difficulty first, draw-one.

## 8. Shared shell

Every game presents the same furniture, in the same places, with the same words:

- **Home**: one large card per game — emoji, name, one-line description, personal best.
  Plus "המשך משחק" when a save exists, and ❓ איך משחקים / ⚙️ הגדרות.
- **Difficulty** chosen in an overlay after picking the game, easiest listed first and
  marked "מומלץ להתחלה".
- **Toolbar**: 🏠 תפריט · ↩️ ביטול · 💡 רמז · 🔄 משחק חדש · ⚙️ — plus at most one
  game-specific button (solitaire adds ⬆️ אסוף הכל).
- **Stats bar**: ניקוד · מהלכים · זמן, plus one game-specific counter, plus the רצף badge.
- **Win**: 🎉 כל הכבוד! → stars animate in one by one → score → שיא חדש if beaten →
  moves and time → 🔄 עוד משחק / 🏠 תפריט. Confetti over the top.
- **Help** is written as instructions to a person, in short sentences, not as rules
  lawyering.

### Shared vocabulary

Use these exact words so nothing has two names:

תפריט · ביטול · רמז · משחק חדש · הגדרות · ניקוד · מהלכים · זמן · רצף · שיא ·
כל הכבוד! · המשך משחק · איך משחקים · קל / בינוני / קשה

## 9. Technical rules that protect the feel

- **One self-contained `.html` per game.** All code, artwork and sound embedded; opens
  offline from a double-click and can be copied anywhere on its own.
- **No CDN, no external fonts, no runtime dependencies.** Nothing that can fail on a slow
  or absent connection.
- **Artwork is embedded base64 and quantised first.** Flat vector-style art drops ~10× to
  a small palette with no visible loss; that is what keeps a single file under ~250 KB.
- **Autosave to `localStorage` after every change**, keyed `hslt_save_<game>`, plus
  `hslt_best_<game><difficulty>`. Closing mid-game loses nothing and resuming asks nothing.
- **Fail safe, never freeze.** The player is alone with no console and no way to recover;
  guard against states that would wedge the board.
- **Ship as a PWA too** — installed, it loses the address bar and tabs, which is a real
  source of confusion.

---

## Adding a game — the checklist

1. Home-screen card: emoji, Hebrew name, one-line description, best score.
2. Difficulty overlay if the game has levels; easiest first and recommended.
3. Standard toolbar and stats bar, same words.
4. Score derived from board state; bonus gated on `peak`; streak breaks only on
   regression or hint.
5. Tap-to-select / tap-to-act; any accelerator optional.
6. Synthesised sounds, pitch carrying meaning.
7. Undo everything, including score and streak.
8. Autosave and resume.
9. Win overlay with stars, confetti, best-score check.
10. Layout computed from the viewport, stable during play, legibility as the floor.
11. Find an honest place for the crest.
12. One file, embedded assets, works offline.
