from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTFITS = [
    ("sapphire", "第45关  蓝宝石骑士礼裙", "#e6efff"),
    ("swan", "第55关  白天鹅舞会礼裙", "#f6f2e8"),
    ("phoenix", "第65关  霞光凤凰礼裙", "#fff0df"),
    ("navigator", "第75关  云海航行礼服", "#e2f8fa"),
    ("wisteria", "第85关  紫藤梦境礼裙", "#f1e9fb"),
    ("aurora", "第95关  极光女王礼服", "#e1f2f5"),
]


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (Path("C:/Windows/Fonts/msyh.ttc"), Path("C:/Windows/Fonts/simhei.ttf")):
        if path.exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


canvas = Image.new("RGB", (1200, 850), "#f8dfe2")
draw = ImageDraw.Draw(canvas)
title_font = font(42)
label_font = font(23)
draw.text((600, 38), "莉莉的衣橱 · 每5关新礼服", font=title_font, fill="#844d66", anchor="ma")

for index, (outfit, label, background) in enumerate(OUTFITS):
    column = index % 3
    row = index // 3
    left = 30 + column * 390
    top = 105 + row * 360
    right = left + 360
    bottom = top + 330
    draw.rounded_rectangle((left, top, right, bottom), 28, fill=background, outline="#e4b8b1", width=4)

    portrait = Image.open(ROOT / "public" / "art" / f"outfit-{outfit}.png").convert("RGBA")
    bbox = portrait.getchannel("A").getbbox()
    portrait = portrait.crop(bbox)
    portrait.thumbnail((270, 255), Image.Resampling.LANCZOS)
    x = left + (360 - portrait.width) // 2
    y = top + 14 + (250 - portrait.height)
    canvas.paste(portrait, (x, y), portrait)
    draw.text((left + 180, bottom - 36), label, font=label_font, fill="#704653", anchor="mm")

output = ROOT / "docs" / "screenshots" / "outfits-every-5-levels.png"
output.parent.mkdir(parents=True, exist_ok=True)
canvas.save(output, optimize=True)
print(output)
