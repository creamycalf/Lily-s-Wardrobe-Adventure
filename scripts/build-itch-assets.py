from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "itch-assets"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(ROOT / "public" / "app-icon.png").convert("RGB")
    canvas = ImageOps.fit(source, (630, 500), method=Image.Resampling.LANCZOS, centering=(0.5, 0.46))
    canvas.save(OUT / "itch-cover-630x500.jpg", quality=94, optimize=True)
    canvas.resize((315, 250), Image.Resampling.LANCZOS).save(
        OUT / "itch-cover-315x250.jpg", quality=94, optimize=True
    )
    print(f"ITCH_COVER_READY={OUT / 'itch-cover-315x250.jpg'}")


if __name__ == "__main__":
    main()
