# Changelog

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and the
changelog is maintained with [commitizen](https://commitizen-tools.github.io/commitizen/):

```powershell
uvx --from commitizen cz bump --yes     # bump version, update this file, tag
uvx --from commitizen cz changelog      # regenerate without bumping
```

## v0.2.0 (2026-09-12)

### Feat

- **score**: break the combo streak when a hint is used

## v0.1.0 (2026-09-12)

First working version, published at <https://adamkatav.github.io/katav-solitaire/>.

### Feat

- **klondike**: draw-one Klondike with unlimited redeals and an "אסוף הכל" auto-collect
- **spider**: Spider at one, two and four suits, with automatic set completion
- **input**: tap-to-select then tap-to-place, with drag as an alternative; nothing
  requires dragging, double-click, right-click or long-press
- **hint**: prioritised hint engine — it solves most Klondike deals unaided, so it
  suggests genuinely useful moves rather than merely legal ones
- **undo**: unlimited undo, restoring score and combo along with the board
- **score**: score derived from board state, with combo multipliers up to ×4, a rising
  arpeggio per combo level and a falling tone when a combo breaks
- **stars**: one-to-five star win rating from moves and time, with saved high scores
- **save**: autosave and resume, so closing mid-game loses nothing
- **cards**: classic red/black deck — correct pip layouts, illustrated court figures and
  the Katav family crest on the back, all embedded as base64 in a single file
- **a11y**: Hebrew RTL throughout, large jumbo indices in both top corners, board
  direction / card size / sound / target-marking settings
- **pwa**: installable as a full-screen app with no address bar or tabs

### Fix

- **score**: moving a card to a foundation and back, or joining and unjoining a
  same-suit run, no longer farms points
- **layout**: fan spacing no longer clips the rank off cards in long columns
- **layout**: fan spacing is fixed for a whole game instead of shifting after each move
- **layout**: board is centred and expands into spare height instead of stranding the
  cards at the top of a tall phone screen
- **anim**: starting a new game mid-deal no longer throws from stale animation timers
