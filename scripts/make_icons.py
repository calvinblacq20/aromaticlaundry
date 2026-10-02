"""Cut the Aromatic Laundry logo into the pieces the site uses, from the one master PNG.

The master is brand/logo/aromatic-laundry-logo.png: the shop's logo on a transparent background,
with the shirt on its hanger, the folded stack and the scent rising above the AROMATIC LAUNDRY
wordmark, the tagline, and a "core service" band under it. The band is flyer copy, not logo, so it
is left out of everything here.

Writes:
  public/brand/al-emblem.webp      the shirt, hanger, stack and scent on a square, for LogoMark/AppIcon
  public/brand/al-logo.webp        emblem, wordmark and tagline together (the lockup)
  public/brand/splash-*.webp       the lockup's parts in white for the black launch screen, each on
                                   the full lockup canvas so they stack exactly; index.html animates
                                   them in one after another
  public/favicon.ico, favicon-32.png, brand/al-app-icon-180.png, brand/al-app-icon-512.png

Usage:  python scripts/make_icons.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "brand" / "logo" / "aromatic-laundry-logo.png"
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"

# The master's edges carry a faint haze and its solid areas sit at about 250 alpha, not 255.
# Alpha below FLOOR goes to 0 and alpha above CEIL to 255; the anti-aliased edge stretches between.
FLOOR, CEIL = 10, 215

# Layers of the lockup, in the order index.html brings them in.
LAYERS = ("scent", "shirt", "stack", "aromatic", "laundry", "tagline")
EMBLEM = ("scent", "shirt", "stack")
SPLASH_WIDTH = 720


def classify(top: int, bottom: int) -> str | None:
    """Which part of the logo a shape belongs to, from where it sits (rows of the 1535x1024 master)."""
    if top < 340:
        if bottom <= 168:
            return "scent"
        return "stack" if top >= 270 else "shirt"
    if top < 545:
        return "aromatic"
    if top < 730:
        return "laundry"
    if top < 790:
        return "tagline"
    return None  # the "our core service" band


def load_layers() -> dict[str, np.ndarray]:
    rgba = np.array(Image.open(MASTER).convert("RGBA")).astype(np.float32)
    alpha = np.clip((rgba[..., 3] - FLOOR) * 255 / (CEIL - FLOOR), 0, 255)

    # Label the solid shapes, give each a layer, then hand every soft edge pixel to its nearest shape.
    labels, count = ndimage.label(alpha > 40)
    layer_of = np.zeros(count + 1, dtype=np.int8)
    for index, box in enumerate(ndimage.find_objects(labels), start=1):
        part = classify(box[0].start, box[0].stop)
        layer_of[index] = LAYERS.index(part) + 1 if part else 0
    nearest = ndimage.distance_transform_edt(labels == 0, return_distances=False, return_indices=True)
    owner = layer_of[labels[nearest[0], nearest[1]]]

    layers = {}
    for i, name in enumerate(LAYERS, start=1):
        layer = rgba.copy()
        layer[..., 3] = np.where(owner == i, alpha, 0)
        layers[name] = layer
    return layers


def white(layer: np.ndarray) -> np.ndarray:
    """The logo in white for the black launch screen. Navy and gold both turn white, and each keeps
    its gloss as a soft grey shade: navy's lightness rides on blue, gold's on green."""
    out = layer.copy()
    r, g, b = layer[..., 0], layer[..., 1], layer[..., 2]
    navy = b > np.maximum(r, g) + 12
    lightness = np.where(navy, (b - 40) / 140, (g - 110) / 100)
    shade = 212 + 43 * np.clip(lightness, 0, 1)
    for channel in range(3):
        out[..., channel] = shade
    return out


def to_image(layer: np.ndarray) -> Image.Image:
    return Image.fromarray(layer.round().astype(np.uint8))


def bbox(layers: dict[str, np.ndarray], names) -> tuple[int, int, int, int]:
    solid = np.zeros(next(iter(layers.values())).shape[:2], dtype=bool)
    for name in names:
        solid |= layers[name][..., 3] > 0
    ys, xs = np.nonzero(solid)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pad(box, margin: int, shape) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    return max(0, x0 - margin), max(0, y0 - margin), min(shape[1], x1 + margin), min(shape[0], y1 + margin)


def square(img: Image.Image, margin: float) -> Image.Image:
    """Centre an image on a transparent square with `margin` of its longer side around it."""
    side = round(max(img.size) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side))
    canvas.alpha_composite(img, ((side - img.width) // 2, (side - img.height) // 2))
    return canvas


def save_webp(img: Image.Image, path: Path):
    img.save(path, "WEBP", quality=88, alpha_quality=90, method=6)


def tile(emblem: Image.Image, size: int, fill: float, radius: float) -> Image.Image:
    """A white tile with the emblem centred on it. radius is a fraction of the side; 0 is a full square."""
    big = size * 4
    canvas = Image.new("RGBA", (big, big))
    white = Image.new("RGBA", (big, big), (255, 255, 255, 255))
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=round(big * radius), fill=255)
    canvas.paste(white, (0, 0), mask)
    side = round(big * fill)
    mark = emblem.resize((side, side), Image.LANCZOS)
    canvas.alpha_composite(mark, ((big - side) // 2, (big - side) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    BRAND.mkdir(parents=True, exist_ok=True)
    layers = load_layers()
    shape = next(iter(layers.values())).shape

    # The lockup: every layer cropped to one shared box, so the splash parts stack exactly.
    x0, y0, x1, y1 = pad(bbox(layers, LAYERS), 6, shape)
    scale = SPLASH_WIDTH / (x1 - x0)
    size = (SPLASH_WIDTH, round((y1 - y0) * scale))
    whole = Image.new("RGBA", size)
    for name in LAYERS:
        crop = layers[name][y0:y1, x0:x1]
        whole.alpha_composite(to_image(crop).resize(size, Image.LANCZOS))
        save_webp(to_image(white(crop)).resize(size, Image.LANCZOS), BRAND / f"splash-{name}.webp")
    save_webp(whole.resize((480, round(size[1] * 480 / size[0])), Image.LANCZOS), BRAND / "al-logo.webp")

    # The emblem on its own, square, for the in-app marks.
    ex0, ey0, ex1, ey1 = bbox(layers, EMBLEM)
    emblem = Image.new("RGBA", (ex1 - ex0, ey1 - ey0))
    for name in EMBLEM:
        emblem.alpha_composite(to_image(layers[name][ey0:ey1, ex0:ex1]))
    emblem = square(emblem, 0.02)
    save_webp(emblem.resize((256, 256), Image.LANCZOS), BRAND / "al-emblem.webp")

    # Browser and home-screen icons: the emblem on white, which reads on light and dark tab bars.
    tile(emblem, 180, 0.74, 0).convert("RGB").save(BRAND / "al-app-icon-180.png")
    tile(emblem, 512, 0.74, 0).convert("RGB").save(BRAND / "al-app-icon-512.png")
    tile(emblem, 32, 0.9, 0.22).save(PUBLIC / "favicon-32.png")
    tile(emblem, 256, 0.9, 0.22).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    print(f"Lockup {size[0]}x{size[1]}; wrote the splash layers, al-logo, al-emblem, favicons and app icons.")


if __name__ == "__main__":
    main()
