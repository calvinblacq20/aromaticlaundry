"""Write the Aromatic Laundry favicon, SVG mark and PNG app icons from one set of shapes.

The geometry matches MARK in src/components/Brand.tsx: the shop's front-loading washer, with the
door and dials cut out of the body and a wave of water inside the door. PNGs are drawn at 4x and
scaled down for clean edges.

Usage:  python scripts/make_icons.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

BLUE = "#0a4fb4"
WHITE = "#ffffff"

BODY = (17, 10, 66, 80, 13)  # x, y, width, height, rx
DIALS = [(30, 23, 3.6), (41, 23, 3.6)]
LIGHT = (60, 71, 23, 5.5)  # x1, x2, y, width
DOOR = (50, 58, 22)  # cx, cy, r
WAVE = "M33.3 60.5 C39 54.5 44.5 66 50 60 C55.5 54 61 65.5 66.7 60.5 A17 17 0 0 1 33.3 60.5 Z"
WAVE_CURVES = [
    ((33.3, 60.5), (39, 54.5), (44.5, 66), (50, 60)),
    ((50, 60), (55.5, 54), (61, 65.5), (66.7, 60.5)),
]
WAVE_ARC = (50, 58, 17)  # the inset circle the wave's bottom follows


def bezier(p0, p1, p2, p3, steps=60):
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        )


def wave_points():
    points = []
    for curve in WAVE_CURVES:
        points.extend(bezier(*curve))
    cx, cy, r = WAVE_ARC
    start = math.atan2(60.5 - cy, 66.7 - cx)
    end = math.atan2(60.5 - cy, 33.3 - cx)
    if end < start:
        end += 2 * math.pi
    for i in range(61):
        a = start + (end - start) * i / 60
        points.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return points


def mark_svg_body(fill: str, cut: str) -> str:
    """The mark as SVG: the body with its holes drawn in the background colour, then the wave."""
    x, y, w, h, rx = BODY
    cx, cy, r = DOOR
    x1, x2, ly, lw = LIGHT
    dials = "".join(f'<circle cx="{dx}" cy="{dy}" r="{dr}" fill="{cut}"/>' for dx, dy, dr in DIALS)
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{cut}"/>{dials}'
        f'<line x1="{x1}" y1="{ly}" x2="{x2}" y2="{ly}" stroke="{cut}" stroke-width="{lw}" stroke-linecap="round"/>'
        f'<path d="{WAVE}" fill="{fill}"/>'
    )


def mask_svg(fill: str) -> str:
    """A transparent-background mark: the holes are cut with a mask so it sits on any colour."""
    x, y, w, h, rx = BODY
    cx, cy, r = DOOR
    x1, x2, ly, lw = LIGHT
    dials = "".join(f'<circle cx="{dx}" cy="{dy}" r="{dr}" fill="#000"/>' for dx, dy, dr in DIALS)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        '<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">'
        f'<rect width="100" height="100" fill="#fff"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="#000"/>{dials}'
        f'<line x1="{x1}" y1="{ly}" x2="{x2}" y2="{ly}" stroke="#000" stroke-width="{lw}" stroke-linecap="round"/>'
        "</mask></defs>"
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" mask="url(#m)"/>'
        f'<path d="{WAVE}" fill="{fill}"/></svg>'
    )


def icon_png(size: int, path: Path):
    scale = 4
    big = size * scale
    img = Image.new("RGB", (big, big), BLUE)
    draw = ImageDraw.Draw(img)
    # The mark fills 64% of the tile, centred, like AppIcon.
    s = big * 0.64 / 100
    off = big * 0.18

    def p(x, y):
        return (off + x * s, off + y * s)

    x, y, w, h, rx = BODY
    draw.rounded_rectangle([p(x, y), p(x + w, y + h)], radius=rx * s, fill=WHITE)
    cx, cy, r = DOOR
    draw.ellipse([p(cx - r, cy - r), p(cx + r, cy + r)], fill=BLUE)
    for dx, dy, dr in DIALS:
        draw.ellipse([p(dx - dr, dy - dr), p(dx + dr, dy + dr)], fill=BLUE)
    x1, x2, ly, lw = LIGHT
    draw.rounded_rectangle([p(x1 - lw / 2, ly - lw / 2), p(x2 + lw / 2, ly + lw / 2)], radius=lw / 2 * s, fill=BLUE)
    draw.polygon([p(px, py) for px, py in wave_points()], fill=WHITE)
    img.resize((size, size), Image.LANCZOS).save(path)


def main():
    (PUBLIC / "brand").mkdir(parents=True, exist_ok=True)
    favicon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -18 136 136">'
        f'<rect x="-18" y="-18" width="136" height="136" rx="30" fill="{BLUE}"/>'
        f"{mark_svg_body(WHITE, BLUE)}</svg>"
    )
    (PUBLIC / "favicon.svg").write_text(favicon + "\n", encoding="utf-8")
    (PUBLIC / "brand" / "al-mark.svg").write_text(mask_svg(BLUE) + "\n", encoding="utf-8")
    icon_png(180, PUBLIC / "brand" / "al-app-icon-180.png")
    icon_png(512, PUBLIC / "brand" / "al-app-icon-512.png")
    icon_png(32, PUBLIC / "favicon-32.png")
    print("Wrote favicon.svg, favicon-32.png, brand/al-mark.svg and the app icons.")


if __name__ == "__main__":
    main()
