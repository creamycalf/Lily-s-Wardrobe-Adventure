from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "video" / "video-folder-story-cut-source-audio-4-third-to-end-final.mp4"
HOME = ROOT / "tmp" / "live-capture-frames" / "09-home-viewport-clean.png"
OUTPUT = ROOT / "tmp" / "final-clean-card-visual.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 24
PROMO_SECONDS = 3.6


def cover(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    scale = max(WIDTH / width, HEIGHT / height)
    resized = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    left = (resized.shape[1] - WIDTH) // 2
    top = (resized.shape[0] - HEIGHT) // 2
    return resized[top : top + HEIGHT, left : left + WIDTH]


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def screen_canvas(image: np.ndarray, zoom: float) -> np.ndarray:
    backdrop = cover(image)
    backdrop = cv2.GaussianBlur(backdrop, (0, 0), 22)
    backdrop = cv2.addWeighted(backdrop, 0.18, np.full_like(backdrop, (224, 190, 198)), 0.82, 0)
    scale = min((WIDTH - 76) / image.shape[1], (HEIGHT - 24) / image.shape[0]) * zoom
    shown = cv2.resize(image, (round(image.shape[1] * scale), round(image.shape[0] * scale)), interpolation=cv2.INTER_CUBIC)
    x = (WIDTH - shown.shape[1]) // 2
    y = (HEIGHT - shown.shape[0]) // 2
    backdrop[y : y + shown.shape[0], x : x + shown.shape[1]] = shown
    return backdrop


def main() -> None:
    capture = cv2.VideoCapture(str(INPUT))
    if not capture.isOpened():
        raise RuntimeError(f"Unable to open {INPUT}")
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = capture.get(cv2.CAP_PROP_FPS) or FPS
    promo_frames = round(PROMO_SECONDS * fps)
    home = cv2.imread(str(HOME), cv2.IMREAD_COLOR)
    if home is None:
        raise RuntimeError(f"Unable to read {HOME}")

    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), fps, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError(f"Unable to open {OUTPUT}")

    index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if index >= total - promo_frames:
            progress = (index - (total - promo_frames)) / max(1, promo_frames - 1)
            frame = screen_canvas(home, 1.0 + 0.035 * smoothstep(progress))
        writer.write(frame)
        index += 1

    capture.release()
    writer.release()
    print(f"Wrote {OUTPUT}")
    print(f"Frames: {index}, duration: {index / fps:.3f}s")


if __name__ == "__main__":
    main()
