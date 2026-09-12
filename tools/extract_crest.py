"""Pull the whole Katav crest (horse + shield + K) out of the card back as a
standalone transparent PNG, for the animation that plays when a column clears.

The crest is one connected gold shape inside the frame - the horse touches the
shield - so a single flood fill picks up the lot. Edges are feathered by
measuring how far each pixel sits along the navy->gold axis, so the silhouette
stays smooth instead of jagged at a hard threshold.
"""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"
GOLD = (212, 175, 55)

sheet = next(ART.glob("Gemini_Generated_Image_*.jpg"))
img = Image.open(sheet).convert("RGB")
W, H = img.size
quad = img.crop((W // 2, H // 2, W, H))
qw, qh = quad.size
px = quad.load()


def gold(x, y):
    r, g, b = px[x, y]
    return r > 120 and g > 90 and b < 140 and r >= g > b


# frame bbox, so we only search inside it
xs = [x for y in range(0, qh, 3) for x in range(qw) if gold(x, y)]
ys = [y for y in range(qh) for x in range(0, qw, 3) if gold(x, y)]
fx0, fx1, fy0, fy1 = min(xs), max(xs), min(ys), max(ys)
inset = int((fx1 - fx0) * 0.09)
ix0, iy0, ix1, iy1 = fx0 + inset, fy0 + inset, fx1 - inset, fy1 - inset

seen = [[False] * qw for _ in range(qh)]
best = None
for sy in range(iy0, iy1):
    for sx in range(ix0, ix1):
        if seen[sy][sx] or not gold(sx, sy):
            continue
        q = deque([(sx, sy)])
        seen[sy][sx] = True
        comp = []
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if ix0 <= nx < ix1 and iy0 <= ny < iy1 and not seen[ny][nx] and gold(nx, ny):
                    seen[ny][nx] = True
                    q.append((nx, ny))
        if len(comp) < 400:
            continue
        if best is None or len(comp) > len(best):
            best = comp

cx0 = min(p[0] for p in best); cx1 = max(p[0] for p in best)
cy0 = min(p[1] for p in best); cy1 = max(p[1] for p in best)
print(f"crest {len(best)} px, bbox ({cx0},{cy0})-({cx1},{cy1})  {cx1-cx0+1}x{cy1-cy0+1}")

pad = 6
cx0, cy0 = max(0, cx0 - pad), max(0, cy0 - pad)
cx1, cy1 = min(qw - 1, cx1 + pad), min(qh - 1, cy1 + pad)
crop = quad.crop((cx0, cy0, cx1 + 1, cy1 + 1))
cw, ch = crop.size
cpx = crop.load()

navy = px[ix0 + 8, iy0 + 8]
vec = [GOLD[i] - navy[i] for i in range(3)]
den = sum(v * v for v in vec) or 1

out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
opx = out.load()
for y in range(ch):
    for x in range(cw):
        p = cpx[x, y]
        t = sum((p[i] - navy[i]) * vec[i] for i in range(3)) / den
        t = max(0.0, min(1.0, t))
        if t > 0.04:
            opx[x, y] = (*GOLD, int(round(255 * t)))

out = out.crop(out.getbbox())
cw, ch = out.size
out = out.resize((220, round(ch * 220 / cw)), Image.LANCZOS)
out.save(ART / "crest.png", optimize=True)
print(f"wrote crest.png {out.size[0]}x{out.size[1]}"
      f"  {(ART / 'crest.png').stat().st_size // 1024} KB")
