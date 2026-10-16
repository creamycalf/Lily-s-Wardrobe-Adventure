from pathlib import Path
import math
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS = 1280, 720, 24
OUTPUT = ROOT / "taptap-promo-current-v2.mp4"


def get_font(size: int, bold: bool = False):
    names = ["msyhbd.ttc" if bold else "msyh.ttc", "simhei.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


FONT_HERO = get_font(54, True)
FONT_TITLE = get_font(36, True)
FONT_BODY = get_font(23)
FONT_SMALL = get_font(18, True)


@lru_cache(maxsize=None)
def load_rgba(relative: str) -> Image.Image:
    return Image.open(ROOT / relative).convert("RGBA")


def fit_cover(image: Image.Image, size=(WIDTH, HEIGHT)) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def fit_contain(image: Image.Image, box):
    x, y, w, h = box
    scale = min(w / image.width, h / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
    return resized, (x + (w - resized.width) // 2, y + (h - resized.height) // 2)


def paste(base: Image.Image, image: Image.Image, box):
    resized, position = fit_contain(image, box)
    base.alpha_composite(resized, position)


def panel(draw: ImageDraw.ImageDraw, box, fill=(70, 39, 45, 168), outline=(255, 242, 220, 210), radius=22, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def label(draw, x, y, title, subtitle, kicker):
    panel(draw, (42, 40, 610, 190))
    draw.text((70, 57), kicker, font=FONT_SMALL, fill=(255, 222, 166, 255))
    draw.text((68, 83), title, font=FONT_HERO, fill=(255, 250, 238, 255), stroke_width=2, stroke_fill=(115, 52, 66, 220))
    draw.text((72, 150), subtitle, font=FONT_BODY, fill=(255, 244, 227, 255))


def add_bottom_fade(image: Image.Image):
    fade = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fade)
    for y in range(HEIGHT):
        alpha = round(110 * max(0, (y - 520) / 200))
        draw.line((0, y, WIDTH, y), fill=(48, 25, 35, alpha))
    image.alpha_composite(fade)


def make_home(progress: float):
    base = fit_cover(load_rgba("public/art-v3/start-screen-clean.png"))
    base = base.resize((round(WIDTH * (1.0 + 0.025 * progress)), round(HEIGHT * (1.0 + 0.025 * progress))), Image.Resampling.LANCZOS)
    base = base.crop(((base.width - WIDTH) // 2, (base.height - HEIGHT) // 2, (base.width + WIDTH) // 2, (base.height + HEIGHT) // 2))
    draw = ImageDraw.Draw(base)
    label(draw, 0, 0, "莉莉的衣橱冒险", "70关推箱解谜 · 梦幻换装", "当前版本首页 · 直接进入衣橱换装")
    draw.rounded_rectangle((70, 548, 310, 604), radius=28, fill=(246, 160, 184, 245), outline=(255, 248, 232, 255), width=4)
    draw.text((128, 562), "开始游戏", font=FONT_BODY, fill=(117, 61, 51, 255))
    draw.rounded_rectangle((70, 615, 328, 672), radius=28, fill=(255, 249, 239, 232), outline=(255, 248, 232, 245), width=2)
    paste(base, load_rgba("public/art/wardrobe.png"), (83, 625, 34, 34))
    draw.text((132, 630), "进入衣橱换装", font=FONT_SMALL, fill=(117, 64, 47, 255))
    return base


def make_wardrobe(progress: float):
    base = fit_cover(load_rgba("public/art-v3/start-screen-clean.png")).filter(ImageFilter.GaussianBlur(15))
    tint = Image.new("RGBA", (WIDTH, HEIGHT), (95, 45, 62, 115))
    base.alpha_composite(tint)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((92, 34, 1188, 686), radius=32, fill=(255, 247, 236, 245), outline=(255, 243, 216, 255), width=6)
    draw.text((138, 62), "莉莉的衣橱", font=FONT_TITLE, fill=(128, 62, 73, 255))
    draw.text((140, 108), "收集星星，解锁新的衣服", font=FONT_BODY, fill=(153, 103, 90, 255))
    draw.rounded_rectangle((130, 155, 460, 634), radius=26, fill=(244, 203, 204, 255), outline=(231, 183, 148, 255), width=3)
    draw.text((196, 570), "当前穿搭", font=FONT_SMALL, fill=(161, 111, 98, 255))
    draw.text((172, 600), "玫瑰晨礼裙", font=FONT_TITLE, fill=(126, 62, 73, 255))
    paste(base, load_rgba("public/art-v2/character-topdown/rose-down.png"), (155, 170, 280, 375))

    outfits = [
        ("rose", "玫瑰晨礼裙", "public/art-v2/character-topdown/rose-down.png", True),
        ("bakery", "蓝莓烘焙裙", "public/art-v3/characters/bakery/down/idle-01.png", False),
        ("garden", "薄荷花园裙", "public/art-v3/characters/garden/down/idle-01.png", False),
        ("starlight", "星空魔法裙", "public/art-v3/characters/starlight/down/idle-01.png", False),
    ]
    for index, (_, name, asset, active) in enumerate(outfits):
        x = 505 + (index % 2) * 315
        y = 160 + (index // 2) * 220
        fill = (255, 251, 241, 255) if active else (235, 220, 215, 235)
        outline = (231, 174, 67, 255) if active else (210, 184, 176, 230)
        draw.rounded_rectangle((x, y, x + 274, y + 184), radius=22, fill=fill, outline=outline, width=4 if active else 2)
        paste(base, load_rgba(asset), (x + 10, y + 10, 100, 158))
        draw.text((x + 116, y + 48), name, font=FONT_SMALL, fill=(119, 69, 61, 255))
        draw.text((x + 116, y + 83), "已解锁" if active else "第5关解锁", font=get_font(16), fill=(165, 123, 107, 255))
    return base


def draw_star(draw, cx, cy, outer, inner, fill):
    points = []
    for i in range(10):
        radius = outer if i % 2 == 0 else inner
        angle = -math.pi / 2 + i * math.pi / 5
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(points, fill=fill)


def make_gameplay(progress: float):
    # This uses the current chapter-01 room and current v3 top-down objects,
    # never the old browser screenshots or the watermarked board composite.
    base = fit_cover(load_rgba("public/art-v2/backgrounds/chapter-01-toy-room.png"))
    draw = ImageDraw.Draw(base, "RGBA")
    draw.rounded_rectangle((42, 32, 1238, 94), radius=28, fill=(84, 48, 49, 180), outline=(255, 238, 205, 220), width=2)
    draw.text((72, 48), "阳光玩具房 · 第1关", font=FONT_TITLE, fill=(255, 248, 230, 255))
    draw.text((945, 53), "步数  0   推箱  0", font=FONT_SMALL, fill=(255, 239, 212, 255))

    left, top, tile_w, tile_h = 300, 158, 96, 54
    for row in range(7):
        for col in range(7):
            x = left + col * tile_w
            y = top + row * tile_h
            border = (173, 120, 82, 220) if row in (0, 6) or col in (0, 6) else (191, 150, 112, 130)
            fill = (133, 75, 52, 225) if row in (0, 6) or col in (0, 6) else (255, 248, 232, 232)
            draw.rounded_rectangle((x + 2, y + 2, x + tile_w - 3, y + tile_h - 3), radius=9, fill=fill, outline=border, width=2)
    # Current target glow and star.
    gx, gy = left + 1 * tile_w + tile_w // 2, top + 3 * tile_h + tile_h // 2
    draw.ellipse((gx - 29, gy - 29, gx + 29, gy + 29), fill=(255, 218, 146, 105), outline=(255, 246, 202, 235), width=3)
    draw_star(draw, gx, gy, 22, 9, (246, 190, 57, 255))
    # Current wooden crate moves toward the target during this scene.
    crate_x = int(left + (4.0 - 1.1 * progress) * tile_w)
    crate_y = top + 3 * tile_h - 20
    paste(base, load_rgba("public/art-v3/objects-topdown/crate-centered.png"), (crate_x - 36, crate_y, 72, 72))
    paste(base, load_rgba("public/art-v3/characters/rose/down/push-01.png"), (left + 5 * tile_w + 4, top + 3 * tile_h - 28, 78, 112))
    paste(base, load_rgba("public/art-v3/objects-topdown/teddy-centered.png"), (left + 2 * tile_w + 7, top + 4 * tile_h - 10, 72, 72))
    paste(base, load_rgba("public/art-v3/objects-topdown/rocking-horse-centered.png"), (left + 4 * tile_w + 8, top + 5 * tile_h - 18, 72, 72))
    panel(draw, (42, 548, 570, 688), fill=(78, 42, 48, 175))
    draw.text((70, 566), "推木箱，点亮星星", font=FONT_TITLE, fill=(255, 248, 231, 255))
    draw.text((72, 620), "人物、木箱、障碍统一落在 7×7 格内", font=FONT_SMALL, fill=(255, 228, 194, 255))
    return base


def make_map(progress: float):
    base = fit_cover(load_rgba("public/art-v3/level-map-clean.png"))
    draw = ImageDraw.Draw(base, "RGBA")
    draw.rounded_rectangle((42, 36, 514, 142), radius=28, fill=(72, 47, 74, 168), outline=(255, 240, 218, 220), width=2)
    draw.text((72, 54), "梦幻旅程", font=FONT_SMALL, fill=(255, 224, 169, 255))
    draw.text((70, 80), "70关，七章解锁", font=FONT_TITLE, fill=(255, 249, 234, 255))
    nodes = [(680, 584), (770, 487), (652, 389), (770, 287), (655, 174)]
    for index, (x, y) in enumerate(nodes):
        draw.ellipse((x - 33, y - 33, x + 33, y + 33), fill=(250, 211, 218, 240), outline=(255, 248, 225, 255), width=4)
        draw.text((x - 9, y - 14), str(index + 1), font=FONT_SMALL, fill=(128, 68, 71, 255))
    draw.text((890, 610), "阳光玩具房 → 草莓茶会厅 → 秘密花园", font=FONT_SMALL, fill=(112, 67, 69, 255))
    return base


def crossfade(previous, current, seconds=0.45):
    count = max(1, int(seconds * FPS))
    for index in range(count):
        alpha = (index + 1) / count
        yield Image.blend(previous, current, alpha)


def segment(factory, seconds):
    count = max(1, int(seconds * FPS))
    for index in range(count):
        yield factory(index / max(1, count - 1))


def main():
    factories = [
        (lambda p: make_home(p), 3.8),
        (lambda p: make_wardrobe(p), 4.5),
        (lambda p: make_gameplay(p), 3.5),
        (lambda p: make_gameplay(1.0), 3.5),
        (lambda p: make_map(p), 3.6),
        (lambda p: make_home(p), 2.2),
    ]
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError("无法创建 MP4 视频文件")
    previous_last = None
    for factory, seconds in factories:
        # Compose each large current-version scene once. Repeating the already
        # rendered frame keeps generation fast and avoids reloading multi-MB art
        # assets for every video frame.
        frame = factory(0).convert("RGB")
        if previous_last is not None:
            for transition in crossfade(previous_last, frame):
                writer.write(cv2.cvtColor(np.asarray(transition.convert("RGB")), cv2.COLOR_RGB2BGR))
        encoded = cv2.cvtColor(np.asarray(frame), cv2.COLOR_RGB2BGR)
        for _ in range(max(1, int(seconds * FPS))):
            writer.write(encoded)
        previous_last = frame
    writer.release()
    capture = cv2.VideoCapture(str(OUTPUT))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = capture.get(cv2.CAP_PROP_FPS)
    capture.release()
    print(f"created={OUTPUT}")
    print(f"size={OUTPUT.stat().st_size} bytes")
    print(f"dimensions={WIDTH}x{HEIGHT} fps={fps:.2f} frames={frame_count} duration={frame_count / fps:.2f}s")


if __name__ == "__main__":
    main()
