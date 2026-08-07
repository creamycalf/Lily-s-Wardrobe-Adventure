from pathlib import Path

from PIL import Image


SOURCES = {
    "down": Path(r"C:\Users\Administrator\AppData\Local\Temp\codex-clipboard-735e9c71-7859-43d0-b431-755b7041f57b.png"),
    "up": Path(r"C:\Users\Administrator\AppData\Local\Temp\codex-clipboard-120137d4-1446-4893-a8da-468ff4d236d5.png"),
    "right": Path(r"C:\Users\Administrator\AppData\Local\Temp\codex-clipboard-29ef0c26-a3c5-4719-872b-c0f4337cde2d.png"),
    "left": Path(r"C:\Users\Administrator\AppData\Local\Temp\codex-clipboard-b2f5d624-9819-41a4-9761-dfbb7b81a408.png"),
}

OUT = Path(__file__).resolve().parents[1] / "tmp" / "character-chroma"
OUT.mkdir(parents=True, exist_ok=True)

for direction, source in SOURCES.items():
    with Image.open(source).convert("RGB") as image:
        side = min(image.width, image.height)
        left = (image.width - side) // 2
        top = (image.height - side) // 2
        crop = image.crop((left, top, left + side, top + side))
        crop.save(OUT / f"rose-{direction}-source.png", optimize=True)
