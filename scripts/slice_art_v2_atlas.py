from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
ATLAS_DIR = ROOT / "public" / "art-v2" / "atlases"
OUTPUT_ROOT = ROOT / "public" / "art-v2" / "objects"


def remove_connected_green(image: Image.Image) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    height, width = rgb.shape[:2]

    greenish = (
        (rgb[:, :, 1] > 92)
        & (rgb[:, :, 1] > rgb[:, :, 0] * 1.06)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.05)
        & ((rgb[:, :, 1] - np.minimum(rgb[:, :, 0], rgb[:, :, 2])) > 20)
    )

    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if greenish[0, x]:
            queue.append((0, x))
        if greenish[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if greenish[y, 0]:
            queue.append((y, 0))
        if greenish[y, width - 1]:
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if y < 0 or x < 0 or y >= height or x >= width:
            continue
        if visited[y, x] or not greenish[y, x]:
            continue
        visited[y, x] = True
        queue.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))

    alpha = rgba[:, :, 3]
    alpha[visited] = 0

    fringe = (
        (~visited)
        & (rgb[:, :, 1] > 82)
        & (rgb[:, :, 1] > rgb[:, :, 0] * 1.035)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.025)
        & ((rgb[:, :, 1] - np.minimum(rgb[:, :, 0], rgb[:, :, 2])) > 10)
    )
    # The generated sheets use a soft green gradient, so a low-alpha green
    # fringe remains visible after a strict flood fill. Remove green spill
    # entirely and feather only the outside edge of the foreground.
    alpha[fringe] = 0
    removed = visited | fringe
    soft_edge = ndimage.binary_dilation(removed, iterations=2) & ~removed
    alpha[soft_edge] = np.minimum(alpha[soft_edge], 150)
    rgba[:, :, 3] = alpha

    result = Image.fromarray(rgba, "RGBA")
    bounds = result.getbbox()
    return result.crop(bounds) if bounds else result


NAMES = (
    ("floor-cream", "goal", "goal-lit", "crate"),
    ("chest-lit", "rail", "bookshelf", "stool"),
    ("chest", "rocking-horse", "wardrobe", "royal-chest"),
    ("teddy", "rocking-horse-alt", "bookshelf-alt", "pink-chest"),
)


def slice_object_atlas(source: Path, output: Path) -> int:
    output.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(source).convert("RGBA")
    cell_width = sheet.width // 4
    cell_height = sheet.height // 4

    for row, names in enumerate(NAMES):
        for column, name in enumerate(names):
            # Keep each generated catalogue cell isolated; extending beyond
            # the 4×4 boundary captures pieces of the neighbouring prop.
            padding = 0
            left = max(0, column * cell_width - padding)
            top = max(0, row * cell_height - padding)
            right = min(sheet.width, (column + 1) * cell_width + padding)
            bottom = min(sheet.height, (row + 1) * cell_height + padding)
            crop = remove_connected_green(sheet.crop((left, top, right, bottom)))
            crop.save(output / f"{name}.png", optimize=True)

    return sum(len(row) for row in NAMES)


def main() -> None:
    total = 0
    for chapter in range(1, 6):
        source = ATLAS_DIR / f"chapter-{chapter:02d}-objects-source.png"
        if not source.exists():
            continue
        output = OUTPUT_ROOT / f"chapter-{chapter:02d}"
        count = slice_object_atlas(source, output)
        total += count
        print(f"Created {count} assets for chapter {chapter:02d}")
    print(f"Created {total} themed object assets in {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
