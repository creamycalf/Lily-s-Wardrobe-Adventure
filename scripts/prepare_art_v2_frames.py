from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "public" / "art-v2" / "frames"

FRAME_NAMES = (
    "frame-01-toy-room",
    "frame-02-tea-room",
    "frame-03-garden-room",
    "frame-04-moon-attic",
    "frame-05-royal-wardrobe",
)


def remove_green_and_islands(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    rgb = rgba[:, :, :3].astype(np.int16)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    green_screen = (
        (green > 75)
        & (green - red > 14)
        & (green - blue > 8)
        & (green > red * 1.05)
        & (green > blue * 1.03)
    )
    alpha = rgba[:, :, 3]
    alpha[green_screen] = 0

    # Keep the largest connected opaque component: the board frame itself.
    labels, count = ndimage.label(alpha > 100)
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        main_label = int(sizes.argmax())
        keep = ndimage.binary_dilation(labels == main_label, iterations=5)
        alpha[~keep] = 0

    rgba[:, :, 3] = alpha
    result = Image.fromarray(rgba, "RGBA")
    bounds = result.getbbox()
    return result.crop(bounds) if bounds else result


def main() -> None:
    for name in FRAME_NAMES:
        source = FRAME_DIR / f"{name}-source.png"
        output = FRAME_DIR / f"{name}.png"
        if not source.exists():
            print(f"Skipped missing {source.name}")
            continue
        remove_green_and_islands(Image.open(source)).save(output, optimize=True)
        print(f"Prepared {output.name}")


if __name__ == "__main__":
    main()
