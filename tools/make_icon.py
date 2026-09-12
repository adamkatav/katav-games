"""Build icon.svg: the Katav crest in gold on the navy card-back field,
square with rounded corners, matching the back of every card.

Embeds art/crest.png so the icon is one self-contained file.
"""
import base64
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"

NAVY, GOLD, SIZE, RADIUS = "#16255c", "#d4af37", 512, 96

crest = Image.open(ART / "crest.png")
cw, ch = crest.size

# Fit the crest to ~62% of the icon height, centred, leaving room for the border.
h = SIZE * 0.62
w = h * cw / ch
x, y = (SIZE - w) / 2, (SIZE - h) / 2

b64 = base64.b64encode((ART / "crest.png").read_bytes()).decode()

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">
  <rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="{NAVY}"/>
  <rect x="26" y="26" width="{SIZE-52}" height="{SIZE-52}" rx="{RADIUS-24}"
        fill="none" stroke="{GOLD}" stroke-width="9"/>
  <rect x="44" y="44" width="{SIZE-88}" height="{SIZE-88}" rx="{RADIUS-40}"
        fill="none" stroke="{GOLD}" stroke-width="3.5" opacity=".75"/>
  <image href="data:image/png;base64,{b64}"
         x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"/>
</svg>
'''

out = ROOT / "icon.svg"
out.write_text(svg, encoding="utf-8")
print(f"wrote icon.svg  {out.stat().st_size // 1024} KB  (crest {cw}x{ch} -> {w:.0f}x{h:.0f})")
