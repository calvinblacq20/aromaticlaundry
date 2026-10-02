"""Crop the chosen stills out of the shop's TikTok videos into brand/photos-original/.

Almost every photo on the site is a frame from @aromatic.laundry1; the two exceptions (kente cloth,
which the shop hasn't filmed yet, and the mall itself) are freely licensed photos in brand/internet/. Most of the shop's videos carry a
caption burned into the top of the frame ("Call/Text 0548908101", "POV: ..."), so each pick says
which part of the frame to keep: `top` and `bottom` are fractions of the frame height, `left` and
`right` fractions of its width. The crop is then trimmed to the photo's aspect ratio around the
centre of what's kept.

Usage:  python scripts/pick_photos.py            (writes every photo)
        python scripts/pick_photos.py --probe    (writes a strip of candidate frames per pick to brand/sheets/)
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "brand" / "source-video"
OUT = ROOT / "brand" / "photos-original"
SHEETS = ROOT / "brand" / "sheets"


@dataclass
class Pick:
    name: str
    video: str
    at: float
    top: float = 0.0
    bottom: float = 1.0
    left: float = 0.0
    right: float = 1.0
    #: Width / height of the finished photo. None keeps the crop as it is.
    ratio: float | None = None


PICKS = [
    Pick("shop-front", "7646467377156148501", 14.0, top=0.12, bottom=0.78, ratio=4 / 5),
    Pick("shop-counter", "7646781272475405589", 21.7, top=0.14, bottom=0.92, ratio=4 / 5),
    Pick("machines", "7646710010172476693", 12.6, top=0.2, bottom=0.9, ratio=4 / 5),
    Pick("folded-stack", "7648693722221169940", 24.5, top=0.28, bottom=0.8, right=0.7, ratio=4 / 5),
    Pick("team", "7648693722221169940", 17.1, top=0.31, bottom=0.76, right=0.7, ratio=4 / 5),
    Pick("shirts-pressed", "7648261643452894485", 6.5, top=0.22, bottom=0.98, ratio=4 / 5),
    Pick("stain-treatment", "7647645416665664788", 18.8, top=0.22, bottom=0.95, ratio=4 / 5),
    Pick("suit-care", "7648356816027438356", 16.8, top=0.37, bottom=0.98, ratio=4 / 5),
    Pick("basket-big", "7686587666485234965", 2.6, top=0.31, bottom=0.95, ratio=4 / 5),
    Pick("basket-small", "7680521068347493652", 2.8, top=0.3, bottom=0.98, ratio=4 / 5),
    Pick("bedding", "7660529234435280148", 8.8, top=0.3, bottom=0.98, ratio=4 / 5),
    Pick("gown", "7675311564437703957", 4.8, top=0.3, bottom=0.84, ratio=4 / 5),
    Pick("handover", "7685908851903794452", 7.2, top=0.2, bottom=0.92, ratio=4 / 5),
    Pick("arrivals", "7679422683053821204", 6.9, top=0.12, bottom=0.9, ratio=4 / 5),
]


@dataclass
class Still:
    """A photo from the internet, used where the shop's own videos have nothing to show."""

    name: str
    file: str
    top: float = 0.0
    bottom: float = 1.0
    left: float = 0.0
    right: float = 1.0
    ratio: float | None = None


#: Freely licensed photos in brand/internet/ (sources and licences in docs/photo-sources.md).
STILLS = [
    Still("kente", "kente-volta.jpg", top=0.0, bottom=0.62, ratio=4 / 5),
    Still("west-hills-mall", "west-hills-mall.jpg", top=0.12, bottom=0.98, ratio=3 / 2),
]


def frame_at(video: str, t: float) -> np.ndarray:
    cap = cv2.VideoCapture(str(VIDEOS / f"{video}.mp4"))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    # Take the sharpest frame within a quarter second either side, so a pick never lands on motion blur.
    best, best_score = None, -1.0
    for offset in np.linspace(-0.25, 0.25, 9):
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int((t + offset) * fps)))
        ok, frame = cap.read()
        if not ok:
            continue
        score = float(cv2.Laplacian(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
        if score > best_score:
            best, best_score = frame, score
    cap.release()
    if best is None:
        raise SystemExit(f"Could not read {video} at {t}s")
    return best


def crop(frame: np.ndarray, pick: Pick | Still) -> np.ndarray:
    h, w = frame.shape[:2]
    y0, y1 = int(pick.top * h), int(pick.bottom * h)
    x0, x1 = int(pick.left * w), int(pick.right * w)
    if pick.ratio:
        cw, ch = x1 - x0, y1 - y0
        if cw / ch > pick.ratio:
            target = int(ch * pick.ratio)
            x0 += (cw - target) // 2
            x1 = x0 + target
        else:
            target = int(cw / pick.ratio)
            y0 += (ch - target) // 2
            y1 = y0 + target
    return frame[y0:y1, x0:x1]


def probe() -> None:
    SHEETS.mkdir(parents=True, exist_ok=True)
    for pick in PICKS:
        tiles = []
        for t in (pick.at - 1.5, pick.at - 0.75, pick.at, pick.at + 0.75, pick.at + 1.5):
            img = crop(frame_at(pick.video, max(0.1, t)), pick)
            img = cv2.resize(img, (round(img.shape[1] * 320 / img.shape[0]), 320))
            cv2.putText(img, f"{t:.2f}s", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
            tiles.append(img)
        cv2.imwrite(str(SHEETS / f"probe-{pick.name}.jpg"), np.hstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(f"Probe strips in {SHEETS.relative_to(ROOT)}")


def main() -> None:
    if "--probe" in sys.argv:
        probe()
        return
    OUT.mkdir(parents=True, exist_ok=True)
    for pick in PICKS:
        img = crop(frame_at(pick.video, pick.at), pick)
        cv2.imwrite(str(OUT / f"{pick.name}.png"), img)
        print(f"{pick.name}: {img.shape[1]}x{img.shape[0]} from {pick.video} at {pick.at}s")
    for still in STILLS:
        source = cv2.imread(str(ROOT / "brand" / "internet" / still.file))
        if source is None:
            raise SystemExit(f"Missing brand/internet/{still.file}")
        img = crop(source, still)
        cv2.imwrite(str(OUT / f"{still.name}.png"), img)
        print(f"{still.name}: {img.shape[1]}x{img.shape[0]} from brand/internet/{still.file}")


if __name__ == "__main__":
    main()
