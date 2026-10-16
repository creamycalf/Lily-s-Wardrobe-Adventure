import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "art-v2" / "character-topdown-manual"
OUT = ROOT / "public" / "art-v2" / "character-topdown"
OUT.mkdir(parents=True, exist_ok=True)

CANVAS = 512
TARGET_HEIGHT = 456
BOTTOM = 496

def normalize(source: Path, out: Path):
    with Image.open(source).convert("RGBA") as image:
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if not bbox:
            return
        subject = image.crop(bbox)
        scale = min((CANVAS - 36) / subject.width, TARGET_HEIGHT / subject.height)
        size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
        subject = subject.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        x = (CANVAS - size[0]) // 2
        y = BOTTOM - size[1]
        canvas.alpha_composite(subject, (x, y))
        canvas.save(out / source.name, optimize=True)


def main():
    parser = argparse.ArgumentParser(description="Normalize character PNGs to the shared 512x512 foot baseline.")
    parser.add_argument("--source", type=Path, default=SOURCE, help="Directory containing source PNGs.")
    parser.add_argument("--out", type=Path, default=OUT, help="Directory for normalized PNGs.")
    parser.add_argument("--pattern", default="*.png", help="Glob pattern for source files.")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for source in args.source.glob(args.pattern):
        normalize(source, args.out)


if __name__ == "__main__":
    main()
