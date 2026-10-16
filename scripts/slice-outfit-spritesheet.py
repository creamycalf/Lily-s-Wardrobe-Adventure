from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from shutil import copy2

from PIL import Image


CANVAS = 512
TARGET_HEIGHT = 456
BOTTOM = 496
DIRECTIONS = ("down", "up", "right")
ACTIONS = ("idle", "walk", "push")


def keep_main_component(image: Image.Image) -> Image.Image:
    """Remove the sparse colored alpha flecks image generators leave behind."""
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    width, height = image.size
    visible = bytearray(1 if value >= 12 else 0 for value in alpha.getdata())
    visited = bytearray(width * height)
    largest: list[int] = []

    for start, present in enumerate(visible):
        if not present or visited[start]:
            continue
        visited[start] = 1
        queue = deque([start])
        component: list[int] = []
        while queue:
            current = queue.popleft()
            component.append(current)
            x = current % width
            y = current // width
            for neighbour in (
                current - 1 if x else -1,
                current + 1 if x + 1 < width else -1,
                current - width if y else -1,
                current + width if y + 1 < height else -1,
            ):
                if neighbour >= 0 and visible[neighbour] and not visited[neighbour]:
                    visited[neighbour] = 1
                    queue.append(neighbour)
        if len(component) > len(largest):
            largest = component

    if not largest:
        raise ValueError("Sprite cell has no visible subject")

    keep = bytearray(width * height)
    for index in largest:
        keep[index] = 1
    pixels = list(image.getdata())
    image.putdata([
        pixel if keep[index] else (0, 0, 0, 0)
        for index, pixel in enumerate(pixels)
    ])
    return image


def normalize(image: Image.Image) -> Image.Image:
    image = keep_main_component(image)
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Sprite cell became empty after cleanup")
    subject = image.crop(bbox)
    scale = min((CANVAS - 36) / subject.width, TARGET_HEIGHT / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((CANVAS - size[0]) // 2, BOTTOM - size[1]))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description="Slice and normalize a 4x3 generated outfit sheet.")
    parser.add_argument("source", type=Path)
    parser.add_argument("outfit")
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    with Image.open(args.source).convert("RGBA") as sheet:
        if sheet.width % 4 or sheet.height % 3:
            raise ValueError(f"Expected a 4x3 sheet, received {sheet.size}")
        cell_width = sheet.width // 4
        cell_height = sheet.height // 3
        if cell_width != cell_height:
            raise ValueError(f"Expected square cells, received {cell_width}x{cell_height}")

        source_dir = args.workspace / "art-source" / "outfit-spritesheets"
        source_dir.mkdir(parents=True, exist_ok=True)
        copy2(args.source, source_dir / f"{args.outfit}-4x3.png")

        character_dir = args.workspace / "public" / "art-v3" / "characters" / args.outfit
        rendered: dict[tuple[str, str], Image.Image] = {}
        # Generated sheets reliably provide front, back and a right-facing profile.
        # Mirror that profile for a guaranteed correctly oriented left sprite.
        column_for_direction = {"down": 0, "up": 1, "right": 2}
        for row, action in enumerate(ACTIONS):
            for direction in DIRECTIONS:
                column = column_for_direction[direction]
                cell = sheet.crop((
                    column * cell_width,
                    row * cell_height,
                    (column + 1) * cell_width,
                    (row + 1) * cell_height,
                ))
                rendered[(direction, action)] = normalize(cell)
            rendered[("left", action)] = rendered[("right", action)].transpose(Image.Transpose.FLIP_LEFT_RIGHT)

        for (direction, action), image in rendered.items():
            output = character_dir / direction / f"{action}-01.png"
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(output, optimize=True)

        portrait = args.workspace / "public" / "art" / f"outfit-{args.outfit}.png"
        rendered[("down", "idle")].save(portrait, optimize=True)

    print(f"{args.outfit}: 12 sprites + portrait written from {args.source.name}")


if __name__ == "__main__":
    main()
