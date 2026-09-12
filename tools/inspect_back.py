"""Measure the card-back asset: where the navy card, the gold frame and the
crest emblem actually sit, so alignment can be fixed from numbers not guesswork."""
from pathlib import Path
from PIL import Image

ART = Path(__file__).resolve().parent.parent / "art"
img = Image.open(ART / "back.png").convert("RGBA")
W, H = img.size
px = img.load()

def is_gold(p):
    r, g, b, a = p
    return a > 128 and r > 120 and g > 90 and b < 130 and r >= g > b

def is_opaque(p):
    return p[3] > 128

def bbox(pred, x0=0, y0=0, x1=None, y1=None):
    x1 = x1 or W; y1 = y1 or H
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pred(px[x, y]):
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)

print(f"image           {W}x{H}   aspect {W/H:.4f}")
print(f"card aspect     100x145   aspect {100/145:.4f}")
print(f"stretch applied {(100/145)/(W/H):.4f}  (horizontal squash by background-size:100% 100%)")

card = bbox(is_opaque)
print(f"\nnavy card bbox  {card}  -> {card[2]-card[0]+1}x{card[3]-card[1]+1}")
print(f"  margins  L={card[0]} R={W-1-card[2]} T={card[1]} B={H-1-card[3]}")

gold = bbox(is_gold)
print(f"\ngold (all) bbox {gold}")
print(f"  frame margins from card edge:"
      f"  L={gold[0]-card[0]} R={card[2]-gold[2]} T={gold[1]-card[1]} B={card[3]-gold[3]}")

# emblem only: look strictly inside the frame band
inset_x = gold[0] + int(0.10 * W)
inset_y = gold[1] + int(0.07 * H)
emb = bbox(is_gold, inset_x, inset_y, gold[2] - int(0.10 * W), gold[3] - int(0.07 * H))
print(f"\nemblem bbox     {emb}  -> {emb[2]-emb[0]+1}x{emb[3]-emb[1]+1}")
ecx = (emb[0] + emb[2]) / 2
ecy = (emb[1] + emb[3]) / 2
ccx = (card[0] + card[2]) / 2
ccy = (card[1] + card[3]) / 2
print(f"  emblem centre {ecx:.1f},{ecy:.1f}   card centre {ccx:.1f},{ccy:.1f}")
print(f"  OFFSET        dx={ecx-ccx:+.1f}px ({(ecx-ccx)/W*100:+.1f}% of width)"
      f"  dy={ecy-ccy:+.1f}px ({(ecy-ccy)/H*100:+.1f}% of height)")
