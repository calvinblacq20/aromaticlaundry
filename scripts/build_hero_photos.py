"""Build the home hero's full-bleed photos from the Unsplash originals in brand/internet.

Each slide gets two crops, because the hero is tall on phones and wide on laptops:
  - tall (3:4) for portrait screens: name-tall-720/1080/1440.webp
  - wide (3:2) for landscape screens: name-wide-1280/1920/2560.webp
The crop boxes keep each subject clear of the centre, where the title sits. Professional photos
are already graded, so they only get the lightest finishing sharpen after the resize.
src/client/home/EditorialHero.tsx lists the files; docs/photo-sources.md credits the photos.

Usage:  python scripts/build_hero_photos.py
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand" / "internet"
OUT = ROOT / "public" / "photos" / "hero"

#: Crop boxes as fractions of the original: (left, top, right, bottom).
SLIDES: dict[str, dict[str, object]] = {
    "towels": {
        "source": "unsplash-towels-mads-leif-hansen.jpg",
        "wide": (0.0, 0.0, 1.0, 1.0),
        "tall": (0.02, 0.0, 0.52, 1.0),
    },
    "bedding": {
        "source": "unsplash-bedsheets-bymatter.jpg",
        "wide": (0.0, 0.33, 1.0, 0.774),
        "tall": (0.0, 0.06, 1.0, 0.949),
    },
    "curtains": {
        "source": "unsplash-curtains-dimas-anggara.jpg",
        "wide": (0.0, 0.45, 1.0, 0.894),
        "tall": (0.0, 0.06, 1.0, 0.949),
    },
    "blazer": {
        "source": "unsplash-blazer-vetrivel-viswanathar.jpg",
        "wide": (0.0, 0.18, 1.0, 0.624),
        "tall": (0.0, 0.05, 1.0, 0.939),
    },
}
WIDTHS = {"tall": (720, 1080, 1440), "wide": (1280, 1920, 2560)}
QUALITY = 82


def crop(img: np.ndarray, box: tuple[float, float, float, float]) -> np.ndarray:
    h, w = img.shape[:2]
    left, top, right, bottom = box
    return img[round(top * h) : round(bottom * h), round(left * w) : round(right * w)]


def resize_to_width(img: np.ndarray, width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= width:
        return img
    return cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)


def finish(img: np.ndarray, amount: float = 0.15, sigma: float = 0.8) -> np.ndarray:
    """Unsharp mask only: the photos' own colour and contrast stay as graded."""
    blurred = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, blurred, -amount, 0)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in SLIDES.items():
        img = cv2.imread(str(SRC / str(spec["source"])))
        if img is None:
            raise SystemExit(f"Missing original for {name}: {SRC / str(spec['source'])}")
        for shape, widths in WIDTHS.items():
            cut = crop(img, spec[shape])  # type: ignore[arg-type]
            for width in widths:
                if cut.shape[1] < width:
                    raise SystemExit(f"{name} {shape} crop is only {cut.shape[1]}px wide, short of {width}px")
                out = finish(resize_to_width(cut, width))
                path = OUT / f"{name}-{shape}-{width}.webp"
                cv2.imwrite(str(path), out, [cv2.IMWRITE_WEBP_QUALITY, QUALITY])
                print(f"{path.relative_to(ROOT)}  {out.shape[1]}x{out.shape[0]}  {path.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
