"""Rebuild the card back from the original Gemini sheet, centred properly.

The first cut trimmed to any non-transparent pixel, so a halo of JPEG-edge
artefacts around the card was kept as "content" - leaving the artwork sitting
32px right and 29px top of where it belonged, and then stretched across the
whole card face. This crops to the gold frame instead, which happens to share
the card's aspect almost exactly (0.6906 vs 0.6897), and centres it on a canvas
cut to the card's own ratio, so background-size:100% 100% neither offsets nor
distorts it.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"

CARD_W, CARD_H = 300, 435          # exactly the 100x145 card ratio
INSET = 0.94                       # frame fills this much of the card, centred

sheet = next(ART.glob("Gemini_Generated_Image_*.jpg"))
img = Image.open(sheet).convert("RGB")
W, H = img.size
quad = img.crop((W // 2, H // 2, W, H))            # back is the bottom-right cell
qw, qh = quad.size
px = quad.load()


def is_gold(x, y):
    r, g, b = px[x, y]
    return r > 120 and g > 90 and b < 140 and r >= g > b


# Bounding box of the gold frame (the element that must sit centred).
xs, ys = [], []
for y in range(qh):
    for x in range(qw):
        if is_gold(x, y):
            xs.append(x)
            ys.append(y)
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
fw, fh = x1 - x0 + 1, y1 - y0 + 1
print(f"gold frame in quadrant: ({x0},{y0})-({x1},{y1})  {fw}x{fh}  aspect {fw/fh:.4f}")
print(f"card aspect {CARD_W/CARD_H:.4f}")

frame = quad.crop((x0, y0, x1 + 1, y1 + 1)).convert("RGBA")

# --- centre the crest inside the frame -----------------------------------
# Gemini drew the horse+shield high, leaving a dead navy band along the bottom.
# Rebuild the interior as flat navy and paste the crest back dead centre.
fpx = frame.load()


def gold_at(x, y):
    r, g, b = fpx[x, y][:3]
    return r > 120 and g > 90 and b < 140 and r >= g > b


# Inner edge of the frame band: last gold run within the first 15% of a mid row.
mid = fh // 2
band = 0
for x in range(int(fw * 0.15)):
    if gold_at(x, mid):
        band = x
band += max(3, int(fw * 0.012))

ix0, iy0 = band, band
ix1, iy1 = fw - band, fh - band

# navy fill colour: sample well inside the interior, away from the crest
navy = fpx[ix0 + 6, iy0 + 6][:3]

cxs, cys = [], []
for y in range(iy0, iy1):
    for x in range(ix0, ix1):
        if gold_at(x, y):
            cxs.append(x)
            cys.append(y)
cx0, cx1, cy0, cy1 = min(cxs), max(cxs), min(cys), max(cys)
pad = 4
crest = frame.crop((max(ix0, cx0 - pad), max(iy0, cy0 - pad),
                    min(ix1, cx1 + pad + 1), min(iy1, cy1 + pad + 1)))
cw, ch = crest.size
print(f"crest {cw}x{ch} was at y {cy0}-{cy1} in interior {iy0}-{iy1}"
      f"  (centre {(cy0+cy1)//2} vs {(iy0+iy1)//2})")

frame.paste(navy + (255,), (ix0, iy0, ix1, iy1))
frame.paste(crest, ((fw - cw) // 2, iy0 + (iy1 - iy0 - ch) // 2))

# Scale uniformly so the frame keeps its proportions, then centre it.
scale = min(CARD_W * INSET / fw, CARD_H * INSET / fh)
nw, nh = round(fw * scale), round(fh * scale)
frame = frame.resize((nw, nh), Image.LANCZOS)

canvas = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
ox, oy = (CARD_W - nw) // 2, (CARD_H - nh) // 2
canvas.paste(frame, (ox, oy))
print(f"placed {nw}x{nh} at ({ox},{oy})  margins L/R={ox} T/B={oy}")

out = canvas.quantize(colors=32, method=Image.Quantize.FASTOCTREE)
out.save(ART / "back.png", optimize=True)
print(f"wrote back.png  {CARD_W}x{CARD_H}  {(ART / 'back.png').stat().st_size // 1024} KB")
