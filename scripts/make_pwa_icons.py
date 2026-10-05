#!/usr/bin/env python3
"""Generate ACE PWA icons: gold spade on casino-noir background (192/512/maskable)."""
from PIL import Image, ImageDraw, ImageFont
import glob

BG = (10, 10, 15, 255)          # #0A0A0F brand background
GOLD_TOP = (244, 211, 94)       # #F4D35E
GOLD_BOT = (212, 175, 55)       # #D4AF37

def find_font(size):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ] + glob.glob('/usr/share/fonts/**/*.ttf', recursive=True)
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()

def gradient(size):
    img = Image.new('RGB', (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        img.putpixel((0, y), tuple(int(GOLD_TOP[i] + (GOLD_BOT[i] - GOLD_TOP[i]) * t) for i in range(3)))
    return img.resize((size, size))

def make_icon(px, maskable=False):
    img = Image.new('RGBA', (px, px), BG)
    d = ImageDraw.Draw(img)

    # radial-ish glow
    if not maskable:
        glow = Image.new('L', (px, px), 0)
        gd = ImageDraw.Draw(glow)
        gd.ellipse([px*0.12, px*0.02, px*0.88, px*0.78], fill=28)
        gold = gradient(px).convert('RGBA')
        gold.putalpha(glow)
        img.alpha_composite(gold)

    # safe zone: maskable keeps 20% padding
    pad = 0.30 if maskable else 0.16
    left, right = int(px*pad), int(px*(1-pad))
    top, bottom = int(px*0.14), int(px*0.86)
    cx = px // 2

    # spade shape: two arcs + stem, drawn as polygons
    spade = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spade)
    w = right - left
    # top point
    sd.polygon([(cx, top), (right, int(top + w*0.62)), (left, int(top + w*0.62))], fill=(255,255,255,255))
    # two lobes (circles)
    r = int(w * 0.31)
    lobe_y = int(top + w*0.55)
    sd.ellipse([cx - int(w*0.5), lobe_y - r, cx, lobe_y + r], fill=(255,255,255,255))
    sd.ellipse([cx, lobe_y - r, cx + int(w*0.5), lobe_y + r], fill=(255,255,255,255))
    # stem
    sd.polygon([
        (cx - int(w*0.10), bottom - int(w*0.02)),
        (cx + int(w*0.10), bottom - int(w*0.02)),
        (cx + int(w*0.03), int(top + w*0.70)),
        (cx - int(w*0.03), int(top + w*0.70)),
    ], fill=(255,255,255,255))

    # apply gold gradient through spade mask
    gold = gradient(px).convert('RGBA')
    gold.putalpha(spade.split()[3])
    img.alpha_composite(gold)

    return img

out = '/home/z/my-project/work/htdocs_src/Htdocs/public/assets/img/icons/'
for px in (192, 512):
    make_icon(px).save(f'{out}icon-{px}.png', optimize=True)
make_icon(512, maskable=True).save(f'{out}icon-maskable-512.png', optimize=True)
make_icon(180).save(f'{out}apple-touch-icon.png', optimize=True)  # iOS home screen
print('icons written')
