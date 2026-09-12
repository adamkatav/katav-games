# Game roadmap

Planning for the games to add next, and the shortlist of what else fits the box.
Design rules live in [DESIGN.md](DESIGN.md); this file is about *what to build* and, for
the two with non-obvious generation, *how the board gets made*.

---

# Minesweeper — מוקשים

## Why it needs a plan

Classic Minesweeper has a flaw that collides head-on with our rules: on many boards you
reach a position where two cells are equally likely and **you must guess**. Losing to a
coin flip breaks the principle that *a loss must be attributable to a decision the player
could have made better*.

So generation has two jobs: place mines, and then **prove the board is solvable by pure
logic**. If it isn't, change it and prove again.

## Board generation

### Step 1 — safe first click

Never generate mines until the player has clicked once. Then place mines anywhere except
the clicked cell **and its eight neighbours**, guaranteeing the first click opens a
cascade rather than ending the game instantly.

```
onFirstClick(r, c):
    forbidden = {(r,c)} ∪ neighbours(r,c)
    place mineCount mines uniformly at random in cells ∉ forbidden
```

### Step 2 — solve it with logic only

A solver that uses exactly the deductions a person makes. Repeat until nothing changes:

1. **Count rule.** For a revealed cell showing `n`, if it already touches `n` flags, every
   other neighbour is safe. If its unknown neighbours number exactly `n − flags`, they are
   all mines.
2. **Subset rule.** For two revealed cells A and B, if A's unknown neighbours are a subset
   of B's, then `B.remaining − A.remaining` mines sit in `B.unknowns − A.unknowns`. When
   that difference is `0` those cells are safe; when it equals the count of that set, they
   are all mines. This is the deduction that resolves most "obvious but not from one cell"
   situations.
3. **Global count.** Near the end, total mines remaining constrains the final unknowns.

If the solver reveals the whole board without ever guessing → the board is fair. Otherwise
regenerate (or, faster, move just the mines involved in the first ambiguity) and retry.
Cap attempts and fall back to a plain random board rather than hanging.

> **Cost note.** Solving is fast (milliseconds) but the loop can run dozens of times on
> hard boards. Generate *after* the first click, show the crest spinner for the handful of
> frames it takes, and cap the attempts.

### Step 3 — flood reveal

Revealing a zero opens its neighbours recursively — the cascade. Animate it outward from
the click, with pitch rising as it expands.

## Rules mapped to the box

| Concern | Decision |
|---|---|
| Two actions, one cell | Toolbar mode switch: **⛏️ חשיפה / 🚩 דגל**, active one lit. Never right-click. |
| Losing | Allowed — it is the game. Reveal the board, mark the fatal mine red and wrong flags with ✗. |
| Fairness | Safe first click + logic-solvable generation. Every loss is then a real mistake. |
| Undo | Flags are undoable. A revealed cell is not, so **no undo button during a round** — offering one that lies is worse than not having it. |
| Score | `10 × cells correctly revealed + 15 × mines correctly flagged`. Derived from the board, so flag/unflag churn earns nothing. |
| Streak | Rises with each safe deduction; broken by a hint. |
| Hint | Runs one solver step and highlights a cell that is provably safe **and says which rule proved it** — it teaches. |
| Difficulty | קל 9×9/10 · בינוני 16×16/40 · קשה 16×30/99. Grid and mines only. |
| Identity | Unrevealed cells are navy with the crest; numbers 1–8 in the classic colours; flag in gold. |

---

# Sudoku — סודוקו

## Board generation

Easier than Minesweeper: the hard part is *difficulty control*, not solvability.

### Step 1 — a full valid grid

Fill an empty grid by backtracking with shuffled candidates:

```
fill(cell):
    if no cells left: return true
    for v in shuffle(1..9):
        if valid(cell, v):
            set(cell, v)
            if fill(next cell): return true
            unset(cell)
    return false
```

Fast — the first solution found is a uniformly varied grid.

### Step 2 — carve holes, keeping exactly one solution

Remove clues one at a time, in random order. After each removal, **count solutions**; if
more than one, put the clue back. A puzzle with two solutions would force guessing, which
breaks the same fairness rule as Minesweeper.

```
for cell in shuffle(all 81):
    saved = grid[cell]; grid[cell] = empty
    if countSolutions(grid, limit=2) != 1:
        grid[cell] = saved          # removal would make it ambiguous
```

`countSolutions` is the same backtracker, stopped at two — you never need the true count.

### Step 3 — rate the difficulty by *how* it is solved

Clue count is a poor difficulty measure. Rate by which techniques the puzzle needs:

| Level | Solvable using |
|---|---|
| קל | Naked singles (one candidate left in a cell) and hidden singles (one place left in a unit) |
| בינוני | + naked/hidden pairs, pointing pairs |
| קשה | + box-line reduction, triples |

Run a technique-limited solver; the hardest technique it required is the rating. Generate,
rate, and keep it if it matches the level asked for.

## Rules mapped to the box

| Concern | Decision |
|---|---|
| Input | Tap a cell, then tap a big number pad 1–9 — never keyboard-only. |
| Two actions | Mode switch **✏️ מספר / 📝 טיוטה** for pencil marks. |
| Losing | **There is none.** Sudoku has no loss condition; do not invent one. Wrong entries are simply correctable. |
| Mistakes | A setting: mark a contradicting entry in red immediately, or stay silent. On by default. |
| Undo | Full — every entry is undoable. |
| Score | `12 × cells correctly filled`, minus nothing. Derived, so re-typing a digit earns nothing. |
| Hint | Fills one cell that a single logical step proves, and names the technique. |
| Given clues | Visually distinct and locked — never editable. |
| Identity | Navy givens on cream, gold for the player's own entries, crest watermark behind the grid. |

---

# Shortlist — what else fits

Ranked by fit with the box: calm, single-player, no reflexes, no timer pressure,
readable at a glance, and playable in short sittings.

| Game | Hebrew | Why it fits | Effort |
|---|---|---|---|
| **FreeCell** | פריסל | Reuses the entire card engine, deck art and rules layer. Nearly every deal is winnable, which suits the no-frustration goal. **Cheapest next game by far.** | S |
| **Memory / pairs** | זיכרון | Trivially simple, genuinely enjoyable at any age, and the crest card backs are already perfect for it. Grid size as difficulty. | S |
| **TriPeaks solitaire** | שלוש פסגות | Another card reuse; fast, forgiving rounds. | S |
| **Mahjong solitaire** | מאהג'ונג | Tile matching, very popular with older players. Needs tile art and a solvable-layout generator (shuffle until solvable). | M |
| **2048** | 2048 | Pure logic, no timer, one clear number per tile. Needs a swipe alternative — four big arrow buttons. | M |
| **Nonograms / picross** | תשבץ יפני | Deduction like Minesweeper but with **no loss at all**; generation must ensure a unique solution, same technique as Sudoku. | M |
| **Kakuro** | קאקורו | Sudoku's cousin; reuses the number-pad input and the uniqueness check. | M |
| **Hearts / Gin** | רמי | Real card play, but needs an opponent AI and is a much bigger build. | L |

**Recommended order:** FreeCell (proves the engine generalises) → Memory (proves a
non-card game fits the shell) → Minesweeper → Sudoku → Nonograms.

## Shared work these imply

Adding a second non-card game will make three things worth extracting from `index.html`
before the fourth game, not after:

1. **The shell** — home screen, toolbar, stats bar, win/loss overlays, settings, help.
2. **The engine** — score/peak/combo, undo stack, autosave, timer, star rating.
3. **The kit** — synthesised sounds, toast, confetti, crest effects, layout maths.

Until then each game stays one self-contained file, duplicating the shell. That is the
right trade at two or three games and the wrong one at five.
