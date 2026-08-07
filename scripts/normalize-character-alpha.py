from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "art-v2" / "character-topdown-manual"
OUT = ROOT / "public" / "art-v2" / "character-topdown"
OUT.mkdir(parents=True, exist_ok=True)

CANVAS = 512
TARGET_HEIGHT = 456
BOTTOM = 496

for source in SOURCE.glob("*.png"):
    with Image.open(source).convert("RGBA") as image:
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if not bbox:
            continue
        subject = image.crop(bbox)
        scale = min((CANVAS - 36) / subject.width, TARGET_HEIGHT / subject.height)
        size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
        subject = subject.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        x = (CANVAS - size[0]) // 2
        y = BOTTOM - size[1]
        canvas.alpha_composite(subject, (x, y))
        canvas.save(OUT / source.name, optimize=True)
