from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "live-capture-frames" / "09-home-viewport.png"
OUTPUT = ROOT / "tmp" / "live-capture-frames" / "09-home-viewport-clean.png"


def main() -> None:
    image = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {SOURCE}")

    # Only the small test/status line is removed. The title, buttons, girl,
    # wardrobe, and all other home-screen elements remain untouched.
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    mask[112:151, 45:310] = 255
    cleaned = cv2.inpaint(image, mask, 7, cv2.INPAINT_NS)
    if not cv2.imwrite(str(OUTPUT), cleaned):
        raise RuntimeError(f"Unable to write {OUTPUT}")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
