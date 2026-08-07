from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from slice_art_v2_atlas import remove_connected_green


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "art-v2" / "atlases" / "girl-actions-source.png"
OUTPUT = ROOT / "public" / "art-v2" / "character"

NAMES = (
    ("idle-left-1", "idle-left-2", "idle-front-1", "idle-right-1", "idle-right-2", "idle-front-2"),
    ("walk-left-1", "walk-left-2", "walk-left-3", "walk-right-1", "walk-right-2", "walk-right-3"),
    ("walk-left-4", "walk-left-5", "walk-front-1", "walk-front-2", "walk-right-4", "walk-right-5"),
    ("push-left-1", "push-left-2", "push-left-3", "push-right-1", "push-right-2", "push-right-3"),
)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = remove_connected_green(Image.open(SOURCE).convert("RGBA"))
    alpha = np.asarray(sheet)[:, :, 3] > 128
    labels, _ = ndimage.label(alpha)

    components: list[tuple[int, int, int, int, int]] = []
    for slices in ndimage.find_objects(labels):
        if slices is None:
            continue
        y_slice, x_slice = slices
        width = x_slice.stop - x_slice.start
        height = y_slice.stop - y_slice.start
        region = labels[slices]
        area = int((region > 0).sum())
        if area > 5_000 and width > 50 and height > 100:
            components.append((x_slice.start, y_slice.start, x_slice.stop, y_slice.stop, area))

    if len(components) != 24:
        raise RuntimeError(f"Expected 24 character silhouettes, found {len(components)}")

    components.sort(key=lambda box: (round(((box[1] + box[3]) / 2) / 400), box[0]))
    padding = 18
    for index, (left, top, right, bottom, _) in enumerate(components):
        row, column = divmod(index, 6)
        name = NAMES[row][column]
        crop = sheet.crop(
            (
                max(0, left - padding),
                max(0, top - padding),
                min(sheet.width, right + padding),
                min(sheet.height, bottom + padding),
            )
        )
        bounds = crop.getbbox()
        if bounds:
            crop = crop.crop(bounds)
        crop.save(OUTPUT / f"{name}.png", optimize=True)

    print(f"Created {sum(len(row) for row in NAMES)} character frames in {OUTPUT}")


if __name__ == "__main__":
    main()
