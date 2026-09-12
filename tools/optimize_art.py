"""Quantise the sliced card art to a small palette.

The artwork is flat vector-style colour, so a 64-colour palette is visually
lossless while cutting file size by roughly 5x - which matters because these
get base64-embedded into index.html.
"""
from pathlib import Path
from PIL import Image

ART = Path(__file__).resolve().parent.parent / "art"

for name, colors in (("king", 64), ("queen", 64), ("jack", 64), ("back", 32)):
    src = ART / f"{name}.png"
    img = Image.open(src).convert("RGBA")
    before = src.stat().st_size

    # FASTOCTREE is the only Pillow quantiser that handles an alpha channel.
    out = img.quantize(colors=colors, method=Image.Quantize.FASTOCTREE)
    out.save(src, optimize=True)

    after = src.stat().st_size
    print(f"{name:<6} {img.width}x{img.height}  {before//1024:>4} KB -> {after//1024:>3} KB")
