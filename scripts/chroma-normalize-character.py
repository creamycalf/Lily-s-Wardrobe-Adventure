from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CANVAS = 512
TARGET_HEIGHT = 456
BOTTOM = 496


def remove_green(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            excess = max(0, g - max(r, b))
            key_alpha = 255 if excess <= 8 else max(0, min(255, 255 - int((excess - 8) * 2.2)))
            pixels[x, y] = (r, g, b, min(a, key_alpha))
    return image


def normalize(source: Path, output: Path) -> None:
    image = remove_green(Image.open(source))
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"No subject remained after chroma-key removal: {source}")
    subject = image.crop(bbox)
    scale = min((CANVAS - 36) / subject.width, TARGET_HEIGHT / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((CANVAS - size[0]) // 2, BOTTOM - size[1]))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    normalize(args.source, args.output)


if __name__ == "__main__":
    main()
