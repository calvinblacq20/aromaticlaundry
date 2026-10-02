"""AI-upscale the soft video stills to 4K with Real-ESRGAN x4plus (ONNX, runs locally on the CPU).

4K here is a 3840px long side, the size scripts/build_photos.py exports as name@4k.webp. Originals
already at 70% of that or more are skipped: build_photos.py resizes those itself, which keeps their
real detail where the model would paint over it.

A still narrower than a quarter of its 4K width is first enlarged to that quarter with Lanczos, then
fed to the model: tried on the 460px `team` still, that came out about 3.5x crisper at the edges than
running the model on the raw pixels and enlarging its output. Wider stills go in as they are (or at
half the 4K width, if larger) and the x4 output is scaled down to 4K. The model runs in overlapping
128px tiles with feathered blending (no seams), and each master is saved as a lossless PNG in
brand/photos-upscaled/. Masters smaller than 4K, from older runs, are redone.

Model: Qualcomm AI Hub release of Real-ESRGAN x4plus (BSD-3-Clause),
https://huggingface.co/qualcomm/Real-ESRGAN-x4plus

Usage:  python scripts/upscale_photos.py --model path/to/real_esrgan_x4plus.onnx [--threads N] [names...]

It takes 2-5 seconds a tile, so a full run is about an hour; run a few processes side by side on
different names, each with --threads set to share the cores.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_photos import NATIVE_ENOUGH, SRC, UHD_LONG, trim_letterbox, uhd_size  # noqa: E402

OUT = SRC.parent / "photos-upscaled"
TILE = 128
OVERLAP = 16
SCALE = 4


def feather(size: int, overlap: int) -> np.ndarray:
    ramp = np.ones(size, np.float32)
    edge = np.linspace(0.0, 1.0, overlap * SCALE, dtype=np.float32)
    ramp[: len(edge)] = edge
    ramp[-len(edge):] = edge[::-1]
    return ramp


def tile_positions(length: int) -> list[int]:
    if length <= TILE:
        return [0]
    step = TILE - OVERLAP
    positions = list(range(0, length - TILE, step))
    positions.append(length - TILE)
    return positions


def upscale(session: ort.InferenceSession, img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    pad_h, pad_w = max(0, TILE - h), max(0, TILE - w)
    if pad_h or pad_w:
        img = cv2.copyMakeBorder(img, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT)
    H, W = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    out = np.zeros((H * SCALE, W * SCALE, 3), np.float32)
    weight = np.zeros((H * SCALE, W * SCALE, 1), np.float32)
    win = feather(TILE * SCALE, OVERLAP)
    mask = (win[:, None] * win[None, :])[..., None]
    input_name = session.get_inputs()[0].name

    ys, xs = tile_positions(H), tile_positions(W)
    total, done, started = len(ys) * len(xs), 0, time.time()
    for y in ys:
        for x in xs:
            patch = rgb[y : y + TILE, x : x + TILE].transpose(2, 0, 1)[None]
            result = session.run(None, {input_name: patch})[0][0].transpose(1, 2, 0)
            oy, ox = y * SCALE, x * SCALE
            out[oy : oy + TILE * SCALE, ox : ox + TILE * SCALE] += result * mask
            weight[oy : oy + TILE * SCALE, ox : ox + TILE * SCALE] += mask
            done += 1
            if done % 20 == 0 or done == total:
                print(f"    {done}/{total} tiles, {time.time() - started:.0f}s", flush=True)

    out /= np.maximum(weight, 1e-6)
    out = np.clip(out[: (H - pad_h) * SCALE, : (W - pad_w) * SCALE], 0.0, 1.0)
    return cv2.cvtColor((out * 255.0).round().astype(np.uint8), cv2.COLOR_RGB2BGR)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--threads", type=int, default=0, help="CPU threads for this process (0 uses them all)")
    parser.add_argument("names", nargs="*")
    args = parser.parse_args()

    options = ort.SessionOptions()
    options.intra_op_num_threads = args.threads
    session = ort.InferenceSession(args.model, options, providers=["CPUExecutionProvider"])
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set(args.names)

    for path in sorted([*SRC.glob("*.jpg"), *SRC.glob("*.png")]):
        name = path.stem
        if wanted and name not in wanted:
            continue
        img = trim_letterbox(cv2.imread(str(path)))
        h, w = img.shape[:2]
        if max(w, h) >= UHD_LONG * NATIVE_ENOUGH:
            print(f"skip {name}: {w}x{h} is close enough to 4K to resize")
            continue
        done = cv2.imread(str(OUT / f"{name}.png"))
        if done is not None and max(done.shape[:2]) >= UHD_LONG:
            print(f"skip {name}: already upscaled")
            continue
        target = uhd_size(w, h)
        quarter, half = target[0] // SCALE, target[0] // 2
        if w < quarter:
            feed = cv2.resize(img, (quarter, round(h * quarter / w)), interpolation=cv2.INTER_LANCZOS4)
        elif w > half:
            feed = cv2.resize(img, (half, round(h * half / w)), interpolation=cv2.INTER_AREA)
        else:
            feed = img
        print(f"{name}: {w}x{h} -> input {feed.shape[1]}x{feed.shape[0]}", flush=True)
        big = upscale(session, feed)
        big = cv2.resize(big, target, interpolation=cv2.INTER_AREA if big.shape[1] > target[0] else cv2.INTER_LANCZOS4)
        cv2.imwrite(str(OUT / f"{name}.png"), big)
        print(f"  saved {big.shape[1]}x{big.shape[0]}", flush=True)


if __name__ == "__main__":
    main()
