from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "art-source"
OUTPUT = ROOT / "public" / "art"
OUTPUT.mkdir(parents=True, exist_ok=True)


def scaled_box(box: tuple[int, int, int, int], reference_width: int = 1600) -> tuple[int, int, int, int]:
    scale = 2048 / reference_width
    return tuple(round(value * scale) for value in box)


def remove_connected_green(image: Image.Image) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    height, width = rgb.shape[:2]

    greenish = (
        (rgb[:, :, 1] > 105)
        & (rgb[:, :, 1] > rgb[:, :, 0] * 1.08)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.08)
        & ((rgb[:, :, 1] - np.minimum(rgb[:, :, 0], rgb[:, :, 2])) > 28)
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
        if y < 0 or x < 0 or y >= height or x >= width or visited[y, x] or not greenish[y, x]:
            continue
        visited[y, x] = True
        queue.append((y - 1, x))
        queue.append((y + 1, x))
        queue.append((y, x - 1))
        queue.append((y, x + 1))

    alpha = rgba[:, :, 3]
    alpha[visited] = 0

    # Softly reduce the remaining green fringe without touching enclosed green clothing.
    fringe = (
        (~visited)
        & (rgb[:, :, 1] > 125)
        & (rgb[:, :, 1] > rgb[:, :, 0] * 1.16)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.12)
    )
    alpha[fringe] = np.minimum(alpha[fringe], 90)
    rgba[:, :, 3] = alpha

    result = Image.fromarray(rgba, "RGBA")
    bounds = result.getbbox()
    if bounds:
        result = result.crop(bounds)
    return result


def save_crop(
    sheet_name: str,
    output_name: str,
    box: tuple[int, int, int, int],
    *,
    scale_from_reference: bool = True,
    transparent: bool = True,
) -> None:
    sheet = Image.open(SOURCE / sheet_name).convert("RGBA")
    crop_box = scaled_box(box) if scale_from_reference else box
    crop = sheet.crop(crop_box)
    if transparent:
        crop = remove_connected_green(crop)
    crop.save(OUTPUT / output_name, optimize=True)


# Character actions. Boxes are measured against the 1600px preview.
character_crops = {
    "girl-idle-down.png": (48, 35, 292, 405),
    "girl-idle-up.png": (565, 40, 790, 405),
    "girl-idle-left.png": (350, 40, 555, 405),
    "girl-idle-right.png": (770, 40, 995, 415),
    "girl-walk-down-1.png": (42, 405, 255, 760),
    "girl-walk-down-2.png": (245, 405, 445, 760),
    "girl-walk-left.png": (40, 770, 285, 1115),
    "girl-walk-right.png": (335, 770, 570, 1115),
    "girl-celebrate.png": (1320, 405, 1595, 770),
    "girl-think.png": (1120, 770, 1390, 1115),
    "girl-push-right.png": (1265, 1120, 1585, 1510),
    "girl-push-left.png": (55, 1120, 335, 1510),
}
for name, box in character_crops.items():
    save_crop("batch-01.png", name, box)


outfit_crops = {
    "outfit-rose.png": (45, 25, 245, 390),
    "outfit-bakery.png": (245, 25, 445, 390),
    "outfit-garden.png": (780, 25, 990, 395),
    "outfit-pearl.png": (1160, 25, 1375, 400),
    "outfit-berry.png": (45, 400, 250, 770),
    "outfit-violet.png": (780, 400, 985, 770),
    "outfit-ice.png": (970, 400, 1190, 775),
    "outfit-moon.png": (1160, 400, 1375, 775),
    "outfit-autumn.png": (1350, 400, 1595, 780),
    "outfit-winter.png": (35, 785, 285, 1145),
    "outfit-starlight.png": (330, 775, 600, 1145),
    "outfit-crown.png": (1325, 1140, 1595, 1545),
}
for name, box in outfit_crops.items():
    save_crop("batch-02.png", name, box)


prop_crops = {
    "tile-floor.png": (45, 75, 325, 360),
    "tile-goal.png": (340, 70, 645, 365),
    "tile-goal-lit.png": (945, 70, 1245, 370),
    "tile-wall.png": (1245, 65, 1590, 380),
    "crate-wood.png": (45, 435, 335, 720),
    "crate-complete.png": (355, 430, 655, 715),
    "wardrobe.png": (935, 790, 1235, 1085),
    "bookshelf.png": (1240, 790, 1590, 1080),
    "teddy.png": (45, 1160, 335, 1485),
    "rocking-horse.png": (350, 1150, 650, 1490),
    "plant.png": (690, 1160, 955, 1485),
    "stool.png": (960, 1150, 1265, 1475),
    "rail.png": (980, 445, 1245, 720),
}
for name, box in prop_crops.items():
    save_crop("batch-03.png", name, box)


ui_crops = {
    "ui-home.png": (55, 45, 225, 220),
    "ui-pause.png": (250, 45, 420, 220),
    "ui-hint.png": (430, 45, 610, 225),
    "ui-back.png": (1020, 45, 1190, 220),
    "ui-restart.png": (50, 245, 225, 420),
    "ui-play.png": (435, 245, 610, 420),
    "ui-music.png": (240, 440, 425, 620),
    "ui-sound.png": (1040, 440, 1225, 620),
    "ui-lock.png": (245, 645, 425, 825),
    "ui-star.png": (435, 645, 610, 825),
    "ui-heart.png": (650, 840, 970, 1095),
    "ui-gift.png": (890, 1110, 1185, 1395),
    "ui-key.png": (1170, 1110, 1420, 1395),
    "ui-button-pink.png": (45, 835, 640, 1090),
    "ui-button-cream.png": (45, 1120, 640, 1355),
}
for name, box in ui_crops.items():
    save_crop("batch-08.png", name, box)


# Full-screen art is kept intact; the UI covers the bottom-right watermark.
Image.open(SOURCE / "batch-05.png").save(OUTPUT / "start-screen.png", optimize=True)
Image.open(SOURCE / "batch-06.png").save(OUTPUT / "result-panels.png", optimize=True)
Image.open(SOURCE / "batch-09.png").save(OUTPUT / "level-map.png", optimize=True)

print(f"Created {len(list(OUTPUT.glob('*.png')))} assets in {OUTPUT}")
