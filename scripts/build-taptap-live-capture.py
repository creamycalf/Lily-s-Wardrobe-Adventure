from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "tmp" / "live-capture-frames"
OUTPUT = ROOT / "taptap-promo-live-capture.mp4"
SIZE = (1280, 720)
FPS = 24


def load_image(name: str) -> np.ndarray:
    path = FRAME_DIR / name
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(path)
    return image


def wardrobe_crop(image: np.ndarray) -> np.ndarray:
    # This is a crop of the real wardrobe modal from the live-page screenshot.
    height, width = image.shape[:2]
    if height <= 800:
        return image
    top = max(0, int(height * 0.21))
    bottom = min(height, int(height * 0.80))
    left = max(0, int(width * 0.02))
    right = min(width, int(width * 0.98))
    return image[top:bottom, left:right]


def fit_on_canvas(image: np.ndarray) -> np.ndarray:
    canvas = np.full((SIZE[1], SIZE[0], 3), (218, 190, 193), dtype=np.uint8)
    image_height, image_width = image.shape[:2]
    scale = min((SIZE[0] - 72) / image_width, (SIZE[1] - 36) / image_height)
    new_size = (max(1, int(image_width * scale)), max(1, int(image_height * scale)))
    resized = cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)
    x = (SIZE[0] - resized.shape[1]) // 2
    y = (SIZE[1] - resized.shape[0]) // 2
    canvas[y : y + resized.shape[0], x : x + resized.shape[1]] = resized
    return canvas


sequence = [
    ("09-home-viewport.png", 2.6),
    ("01-level-top.png", 3.2),
    ("14-level-after-moves-top.png", 3.0),
    ("11-level-after-up-viewport.png", 2.4),
    ("12-level-after-right-viewport.png", 2.4),
    ("07-wardrobe-full.png", 3.4),
    ("09-home-viewport.png", 2.2),
]

writer = cv2.VideoWriter(
    str(OUTPUT),
    cv2.VideoWriter_fourcc(*"mp4v"),
    FPS,
    SIZE,
)
if not writer.isOpened():
    raise RuntimeError(f"Cannot open video writer: {OUTPUT}")

for name, seconds in sequence:
    image = load_image(name)
    if name == "07-wardrobe-full.png":
        image = wardrobe_crop(image)
    frame = fit_on_canvas(image)
    for _ in range(round(seconds * FPS)):
        writer.write(frame)

writer.release()
print(f"Wrote {OUTPUT}")
print(f"Resolution: {SIZE[0]}x{SIZE[1]}, duration: {sum(seconds for _, seconds in sequence):.1f}s")
