# Image prompts for Gemini (Nano Banana 2)

You need **4 images total**. A real deck reuses the same court figure across all four
suits — only the corner index and the small pip change colour — and classic court cards
are just the figure mirrored top-to-bottom. So we generate three half-figures and one
card back, and the code does the rest (mirroring, red/black tinting, pips, indices).

## Where to save them

Save into `art/` in this folder, with these **exact** filenames:

| File | What |
|---|---|
| `art/jack.png` | Jack half-figure |
| `art/queen.png` | Queen half-figure |
| `art/king.png` | King half-figure |
| `art/back.png` | Katav family crest (card back) |

PNG. **Transparent background preferred, but plain flat white is perfectly fine** for the
three court figures — they sit on a white card anyway, so don't fight Gemini over
transparency. The crest (`back.png`) should NOT be transparent; it needs its navy field.

Aim for roughly 1024x1024 for the figures and 1000x1400 for the back. Bigger is fine —
I'll downscale before embedding so the final file stays reasonable.

---

## 1. KING — save as `art/king.png`

```
A single traditional playing-card court figure: the KING, drawn in the classic
English/French playing-card style of a standard Bicycle or Waddington deck.

Show ONLY the upper half of the figure — crown, head, shoulders and chest down to
roughly the waist — exactly as it appears in the top half of a double-ended court card.
The figure faces three-quarters toward the viewer's left. He wears an ornate crown and a
patterned royal robe with a high collar.

Style: flat vector illustration with bold, uniform black outlines and completely flat
colour fills. Absolutely NO shading, NO gradients, NO texture, NO drop shadows, NO 3D.
Heraldic, decorative and slightly geometric — like a 19th-century engraved playing card
redrawn as clean modern vector art.

Palette: strictly five colours only — white, black, playing-card red (#C8102E), royal
blue (#1B3A8C), and antique gold (#E0A526). The face and hands are white with black line
detail only.

Composition: figure centred, filling the frame edge to edge, cropped flat straight across
the bottom at the waist. Square 1:1 canvas.

Background: flat plain white, with nothing behind the figure.

Do NOT include: any letters, numbers or words; any suit symbols (no hearts, spades,
diamonds or clubs); no card border, frame or rectangle; no signature or watermark; no
bottom half or mirrored second figure. Only the single upright half-figure.
```

## 2. QUEEN — save as `art/queen.png`

```
A single traditional playing-card court figure: the QUEEN, drawn in the classic
English/French playing-card style of a standard Bicycle or Waddington deck.

Show ONLY the upper half of the figure — crown, head, shoulders and chest down to
roughly the waist — exactly as it appears in the top half of a double-ended court card.
The figure faces three-quarters toward the viewer's left. She wears a delicate pointed
crown, has long styled hair, and holds a single stylised flower near her shoulder.

Style: flat vector illustration with bold, uniform black outlines and completely flat
colour fills. Absolutely NO shading, NO gradients, NO texture, NO drop shadows, NO 3D.
Heraldic, decorative and slightly geometric — like a 19th-century engraved playing card
redrawn as clean modern vector art.

Palette: strictly five colours only — white, black, playing-card red (#C8102E), royal
blue (#1B3A8C), and antique gold (#E0A526). The face and hands are white with black line
detail only.

Composition: figure centred, filling the frame edge to edge, cropped flat straight across
the bottom at the waist. Square 1:1 canvas.

Background: flat plain white, with nothing behind the figure.

Do NOT include: any letters, numbers or words; any suit symbols (no hearts, spades,
diamonds or clubs); no card border, frame or rectangle; no signature or watermark; no
bottom half or mirrored second figure. Only the single upright half-figure.
```

## 3. JACK — save as `art/jack.png`

```
A single traditional playing-card court figure: the JACK (knave), drawn in the classic
English/French playing-card style of a standard Bicycle or Waddington deck.

Show ONLY the upper half of the figure — hat, head, shoulders and chest down to roughly
the waist — exactly as it appears in the top half of a double-ended court card. A young
clean-shaven attendant facing three-quarters toward the viewer's left, wearing a soft
feathered cap and a patterned doublet with a high collar.

Style: flat vector illustration with bold, uniform black outlines and completely flat
colour fills. Absolutely NO shading, NO gradients, NO texture, NO drop shadows, NO 3D.
Heraldic, decorative and slightly geometric — like a 19th-century engraved playing card
redrawn as clean modern vector art.

Palette: strictly five colours only — white, black, playing-card red (#C8102E), royal
blue (#1B3A8C), and antique gold (#E0A526). The face and hands are white with black line
detail only.

Composition: figure centred, filling the frame edge to edge, cropped flat straight across
the bottom at the waist. Square 1:1 canvas.

Background: flat plain white, with nothing behind the figure.

Do NOT include: any letters, numbers or words; any suit symbols (no hearts, spades,
diamonds or clubs); no card border, frame or rectangle; no signature or watermark; no
bottom half or mirrored second figure. Only the single upright half-figure.
```

## 4. KATAV FAMILY CREST — save as `art/back.png`

This is the back of every card, so it is seen constantly — worth a few regeneration
attempts to get right.

```
The back of a playing card, bearing a heraldic family crest. Portrait canvas with a
standard playing-card aspect ratio of 2.5:3.5.

Composition, strictly centred and left-right symmetrical:
- An ornamental double border frames the whole card, set just inside the edges.
- In the centre, a classic heraldic shield bearing one large ornate serif capital
  letter "K".
- Directly above the shield, a noble horse's head in profile facing left — the classic
  heraldic destrier / chess-knight, with a flowing stylised mane.
- Small restrained flourishes and a single five-pointed star above and below the crest.

Style: flat vector heraldry. Elegant, regal and slick — confident and uncluttered rather
than busy or ornate-to-the-point-of-noise. NO photorealism, NO 3D, NO gradients, NO
shading, NO texture, NO emboss.

Palette: exactly two colours — antique gold (#D4AF37) for every line, shape and letter,
on a deep royal navy blue (#16255C) field. Nothing else.

The navy fills the entire canvas edge to edge with no white margin anywhere.

Do NOT include: any text or lettering other than the single letter "K"; no suit symbols;
no watermark or signature; no drop shadows; no white border or background.
```

---

## Notes

- If a court figure comes out facing the wrong way or cropped oddly, just regenerate —
  consistency between the three figures matters more than any one of them being perfect.
- The three court figures should look like they belong to the same deck. If they drift
  apart in style, generate the King first and then ask Gemini to "draw the Queen in
  exactly the same style as this image", attaching the King.
- Once the four files are in `art/`, I'll downscale them, base64-embed them into
  `index.html`, and build the double-ended court cards around them.
