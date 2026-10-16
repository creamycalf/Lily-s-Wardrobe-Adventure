from pathlib import Path
from shutil import copy2

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "3839-assets"


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in (
        Path("C:/Windows/Fonts/msyhbd.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise FileNotFoundError("No Chinese font found")


def cover(image: Image.Image, size: tuple[int, int], center_x: float = 0.5) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    overflow_x = max(0, resized.width - target_w)
    left = round(overflow_x * center_x)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def build_store_cover(source: Image.Image) -> Path:
    canvas = cover(source, (1280, 720)).convert("RGBA")
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    for y in range(230):
        alpha = round(92 * (1 - y / 230))
        shade_draw.line((0, y, 1280, y), fill=(83, 42, 52, alpha))
    canvas.alpha_composite(shade)

    draw = ImageDraw.Draw(canvas)
    title = "莉莉的衣橱冒险"
    title_font = font(66)
    box = draw.textbbox((0, 0), title, font=title_font, stroke_width=2)
    x = (1280 - (box[2] - box[0])) // 2
    draw.text(
        (x, 62),
        title,
        font=title_font,
        fill=(255, 250, 238, 255),
        stroke_width=3,
        stroke_fill=(126, 57, 74, 235),
    )
    path = OUT / "game-cover-1280x720.jpg"
    canvas.convert("RGB").save(path, quality=90, optimize=True, progressive=True)
    return path


def build_promo(source: Image.Image) -> Path:
    # Favor the right side of the clean illustration so Lily, the treasure
    # chest and wardrobe are all visible. Platform rules forbid text and logos.
    canvas = cover(source, (1020, 840), center_x=0.78).convert("RGB")
    path = OUT / "game-promo-1020x840.jpg"
    canvas.save(path, quality=90, optimize=True, progressive=True)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(ROOT / "public" / "art-v3" / "start-screen-clean.png").convert("RGB")
    outputs = [build_store_cover(source), build_promo(source)]

    copies = {
        ROOT / "public" / "store-icon-256.jpg": OUT / "game-icon-256.jpg",
        ROOT / "output" / "compliance-startup-mobile.png": OUT / "age-guide-8plus.png",
        ROOT / "docs" / "screenshots" / "level-80-crystal-mobile.png": OUT / "game-screenshot-01.png",
        ROOT / "docs" / "screenshots" / "level-90-roseclock-mobile.png": OUT / "game-screenshot-02.png",
        ROOT / "docs" / "screenshots" / "level-100-eternal-mobile.png": OUT / "game-screenshot-03.png",
    }
    for source_path, destination in copies.items():
        copy2(source_path, destination)
        outputs.append(destination)

    for output in outputs:
        with Image.open(output) as image:
            print(f"{output.name}: {image.width}x{image.height}, {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
