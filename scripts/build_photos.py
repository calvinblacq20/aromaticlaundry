"""Build web photos from the full-size originals in brand/photos-original.

For each original:
  1. trim black letterbox bands left by TikTok,
  2. bring it to 4K (a 3840px long side): the Real-ESRGAN master from scripts/upscale_photos.py
     when there is one, otherwise a Lanczos resize for photos already close to 4K,
  3. sharpen to suit the source: video stills get a light finish and a little local contrast so
     fabric texture reads clearly, professional photos only the lightest touch so their grade stays,
  4. export four WebP files: name-sm.webp (480px, thumbnails and grids on data),
     name.webp (1080px), name@2x.webp (2160px, retina phones and laptops) and
     name@4k.webp (3840px long side, 4K and 5K screens).

A small original with no upscaled master skips the 4K file rather than blowing up its pixels.

Writes src/data/photo-manifest.json with the real pixel widths so <img srcset>
can let each device pick the right file.

Usage:  python scripts/build_photos.py
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand" / "photos-original"
UPSCALED = ROOT / "brand" / "photos-upscaled"  # optional AI output from scripts/upscale_photos.py
OUT = ROOT / "public" / "photos"
MANIFEST = ROOT / "src" / "data" / "photo-manifest.json"

SMALL_WIDTH = 480
BASE_WIDTH = 1080
RETINA_WIDTH = 2160
#: Long side of a 4K UHD frame: 3072×3840 for the 4:5 photos, 3840×2560 for the 3:2 one.
UHD_LONG = 3840
#: Originals at least this share of 4K are resized up with Lanczos; anything smaller needs the AI master.
NATIVE_ENOUGH = 0.7


def trim_letterbox(img: np.ndarray, threshold: float = 14.0) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    rows, cols = gray.mean(axis=1), gray.mean(axis=0)

    def bounds(line: np.ndarray) -> tuple[int, int]:
        n = len(line)
        start = 0
        while start < n * 0.3 and line[start] < threshold:
            start += 1
        end = n - 1
        while end > n * 0.7 and line[end] < threshold:
            end -= 1
        return start, end + 1

    top, bottom = bounds(rows)
    left, right = bounds(cols)
    return img[top:bottom, left:right]


def sharpness(img: np.ndarray) -> float:
    return float(cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


def enhance(img: np.ndarray, ai_upscaled: bool = False) -> np.ndarray:
    detail = sharpness(img)

    if ai_upscaled:
        # AI output is already clean and crisp: only a light finishing sharpen.
        amount, sigma = 0.25, 1.0
    else:
        # Very "busy" images at this size are usually JPEG noise, not detail: clean lightly first.
        if detail > 400:
            img = cv2.fastNlMeansDenoisingColored(img, None, 3, 3, 7, 21)
        # Adaptive unsharp mask: soft photos get a stronger, wider sharpen.
        if detail < 50:
            amount, sigma = 1.0, 1.6
        elif detail < 200:
            amount, sigma = 0.7, 1.2
        else:
            amount, sigma = 0.4, 1.0
    blurred = cv2.GaussianBlur(img, (0, 0), sigma)
    img = cv2.addWeighted(img, 1 + amount, blurred, -amount, 0)

    # Gentle local contrast on lightness only, blended at 40% to keep skin and colours natural.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l_clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply(l)
    l = cv2.addWeighted(l, 0.6, l_clahe, 0.4, 0)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


def finish(img: np.ndarray, amount: float, sigma: float) -> np.ndarray:
    """Unsharp mask only, for professional photos whose colour and contrast are already graded."""
    blurred = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, blurred, -amount, 0)


def uhd_size(w: int, h: int) -> tuple[int, int]:
    scale = UHD_LONG / max(w, h)
    return round(w * scale), round(h * scale)


def resize_to(img: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    if (img.shape[1], img.shape[0]) == size:
        return img
    interpolation = cv2.INTER_AREA if size[0] < img.shape[1] else cv2.INTER_LANCZOS4
    return cv2.resize(img, size, interpolation=interpolation)


def resize_to_width(img: np.ndarray, width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= width:
        return img
    return cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, int]] = {}
    originals = sorted([*SRC.glob("*.jpg"), *SRC.glob("*.png")])
    if not originals:
        raise SystemExit(f"No originals found in {SRC}")

    for path in originals:
        name = path.stem
        img = cv2.imread(str(path))
        if img is None:
            print(f"skip {name}: unreadable")
            continue
        img = trim_letterbox(img)
        h, w = img.shape[:2]
        uhd = uhd_size(w, h)
        upscaled_path = UPSCALED / f"{name}.png"
        ai = cv2.imread(str(upscaled_path)) if upscaled_path.exists() else None
        if ai is not None:
            # Blend a little of the original back in so skin and fabric keep natural grain.
            original_big = cv2.resize(img, uhd, interpolation=cv2.INTER_LANCZOS4)
            img = enhance(cv2.addWeighted(resize_to(ai, uhd), 0.82, original_big, 0.18, 0), ai_upscaled=True)
        elif max(w, h) >= UHD_LONG:
            img = finish(resize_to(img, uhd), 0.15, 0.8)
        elif max(w, h) >= UHD_LONG * NATIVE_ENOUGH:
            # Enlarged a little: a slightly firmer sharpen brings back the edge the resize softened.
            img = finish(resize_to(img, uhd), 0.35, 1.2)
        else:
            img = enhance(img)

        tiers = [("-sm", SMALL_WIDTH, 84), ("", BASE_WIDTH, 88), ("@2x", RETINA_WIDTH, 90)]
        if max(img.shape[:2]) >= UHD_LONG:
            tiers.append(("@4k", img.shape[1], 85))
        else:
            (OUT / f"{name}@4k.webp").unlink(missing_ok=True)
        files: dict[str, tuple[np.ndarray, Path]] = {}
        for suffix, width, quality in tiers:
            out = resize_to_width(img, width)
            files[suffix] = (out, OUT / f"{name}{suffix}.webp")
            cv2.imwrite(str(files[suffix][1]), out, [cv2.IMWRITE_WEBP_QUALITY, quality])

        width_of = {suffix: int(out.shape[1]) for suffix, (out, _) in files.items()}
        manifest[name] = {"sm": width_of["-sm"], "w": width_of[""], "w2x": width_of["@2x"], "h": int(files[""][0].shape[0])}
        if "@4k" in width_of:
            manifest[name]["w4k"] = width_of["@4k"]
        sizes = " | ".join(f"{path.stat().st_size // 1024}KB" for _, path in files.values())
        print(f"{name:26s} {'/'.join(map(str, width_of.values()))}w  {sizes}")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {MANIFEST.relative_to(ROOT)} ({len(manifest)} photos)")


if __name__ == "__main__":
    main()
