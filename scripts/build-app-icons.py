from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "app-icon.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"


def cover(source: Image.Image, size: int) -> Image.Image:
    width, height = source.size
    scale = max(size / width, size / height)
    resized = source.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size) // 2
    top = (resized.height - size) // 2
    return resized.crop((left, top, left + size, top + size)).convert("RGBA")


def masked_icon(source: Image.Image, size: int, shape: str) -> Image.Image:
    icon = cover(source, size)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    if shape == "circle":
        draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=max(2, round(size * 0.2)), fill=255)
    icon.putalpha(mask)
    return icon


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    master = cover(source, 1024).convert("RGB")
    master.save(SOURCE, "PNG", optimize=True)

    densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for density, size in densities.items():
        target = RES / f"mipmap-{density}"
        target.mkdir(parents=True, exist_ok=True)
        masked_icon(master, size, "rounded").save(target / "ic_launcher.png", optimize=True)
        masked_icon(master, size, "circle").save(target / "ic_launcher_round.png", optimize=True)
        cover(master, round(size * 2.25)).save(target / "ic_launcher_foreground.png", optimize=True)

    favicon = cover(master, 192)
    favicon.save(ROOT / "public" / "favicon.png", optimize=True)
    store_icon = cover(master, 256).convert("RGB")
    store_icon.save(ROOT / "public" / "store-icon-256.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    master.save(
        ROOT / "desktop" / "app-icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(f"ICON_READY={SOURCE}")


if __name__ == "__main__":
    main()
