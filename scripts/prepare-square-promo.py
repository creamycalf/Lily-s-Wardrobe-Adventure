from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\Administrator\.codex\generated_images\019fe3f4-42c0-7480-841c-b27e6a913aeb\exec-c4d2630f-a8dc-4dc0-8b0b-825b7d8e207b.png")
OUTPUT = ROOT / "video" / "lili-wardrobe-adventure-promo-1x1.jpg"
SIZE = 1536
TITLE = "莉莉的衣橱冒险"


def main() -> None:
    image = Image.open(SOURCE).convert("RGB")
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=3))

    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(r"C:\Windows\Fonts\simkai.ttf", 98)
    shadow = (113, 50, 62)
    fill = (255, 244, 226)
    stroke = (137, 65, 76)

    # Use the open, bright upper-left area for the title. This is the only text
    # added to the artwork; no buttons, level counts, slogans, or test copy.
    box = draw.textbbox((0, 0), TITLE, font=font, stroke_width=3)
    text_width = box[2] - box[0]
    x = (SIZE - text_width) // 2
    y = 54
    draw.text((x + 3, y + 5), TITLE, font=font, fill=shadow, stroke_width=5, stroke_fill=(255, 224, 205))
    draw.text((x, y), TITLE, font=font, fill=fill, stroke_width=3, stroke_fill=stroke)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="JPEG", quality=92, optimize=True, progressive=True, subsampling=0)
    print(f"Wrote {OUTPUT}")
    print(f"Size: {image.size[0]}x{image.size[1]}")
    print(f"Bytes: {OUTPUT.stat().st_size}")


if __name__ == "__main__":
    main()
