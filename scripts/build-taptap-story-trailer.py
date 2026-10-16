from pathlib import Path
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "tmp" / "live-capture-frames"
OUT = ROOT / "taptap-story-trailer.mp4"
WIDTH, HEIGHT = 1280, 720
FPS = 24
FONT = Path("C:/Windows/Fonts/msyh.ttc")


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def load_live(name: str) -> Image.Image:
    image = rgba(FRAME_DIR / name)
    # Remove the browser scrollbar while retaining the real page content.
    if image.width > 795:
        image = image.crop((0, 0, 790, image.height))
    return image


def crop_wardrobe(image: Image.Image) -> Image.Image:
    if image.height < 800:
        return image
    return image.crop((12, 245, image.width - 12, 980))


def font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc")
    return ImageFont.truetype(str(path), size=size, index=0)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def contain(image: Image.Image, size: tuple[int, int]) -> tuple[Image.Image, tuple[int, int, int, int]]:
    target_w, target_h = size
    scale = min(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    x = (target_w - resized.width) // 2
    y = (target_h - resized.height) // 2
    return resized, (x, y, resized.width, resized.height)


def camera(image: Image.Image, progress: float, zoom_start=1.0, zoom_end=1.06, focus=(0.5, 0.5)) -> Image.Image:
    base = cover(image, (WIDTH, HEIGHT))
    zoom = zoom_start + (zoom_end - zoom_start) * progress
    scaled = base.resize((round(WIDTH * zoom), round(HEIGHT * zoom)), Image.Resampling.LANCZOS)
    max_x = scaled.width - WIDTH
    max_y = scaled.height - HEIGHT
    left = round(max_x * (focus[0] - 0.5) * 1.8 + max_x / 2)
    top = round(max_y * (focus[1] - 0.5) * 1.8 + max_y / 2)
    left = max(0, min(max_x, left))
    top = max(0, min(max_y, top))
    return scaled.crop((left, top, left + WIDTH, top + HEIGHT))


def rounded_panel(base: Image.Image, box, fill, radius=24, outline=None, width=2):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    base.alpha_composite(overlay)


def text(base: Image.Image, xy, value: str, size: int, fill=(255, 255, 255, 255), bold=False, spacing=8, anchor=None):
    draw = ImageDraw.Draw(base)
    draw.multiline_text(xy, value, font=font(size, bold), fill=fill, spacing=spacing, anchor=anchor)


def fade(value: float) -> int:
    return round(255 * max(0.0, min(1.0, value)))


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def add_vignette(base: Image.Image, strength=0.35):
    alpha = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
    for y in range(HEIGHT):
        for x in range(WIDTH):
            dx = (x - WIDTH / 2) / (WIDTH / 2)
            dy = (y - HEIGHT / 2) / (HEIGHT / 2)
            alpha[y, x] = round(255 * strength * min(1.0, (dx * dx + dy * dy) / 1.3))
    layer = Image.new("RGBA", base.size, (45, 20, 35, 0))
    layer.putalpha(Image.fromarray(alpha, mode="L"))
    base.alpha_composite(layer)


def draw_glow_circle(base: Image.Image, center, radius, progress, color=(255, 218, 105, 220)):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    pulse = 0.92 + 0.12 * math.sin(progress * math.pi * 4)
    r = radius * pulse
    for spread, alpha in ((18, 28), (10, 60), (3, 190)):
        draw.ellipse((center[0] - r - spread, center[1] - r - spread, center[0] + r + spread, center[1] + r + spread), outline=(*color[:3], alpha), width=3)
    base.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(2)))


def draw_arrow(base: Image.Image, start, end, progress, color=(255, 222, 110, 235)):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    p = ease(progress)
    ex = start[0] + (end[0] - start[0]) * p
    ey = start[1] + (end[1] - start[1]) * p
    draw.line((start[0], start[1], ex, ey), fill=(*color[:3], 180), width=8)
    angle = math.atan2(ey - start[1], ex - start[0])
    head = 25
    points = [
        (ex, ey),
        (ex - head * math.cos(angle - 0.52), ey - head * math.sin(angle - 0.52)),
        (ex - head * math.cos(angle + 0.52), ey - head * math.sin(angle + 0.52)),
    ]
    draw.polygon(points, fill=(*color[:3], 235))
    base.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(1)))


def board_scene(source: Image.Image, progress: float, title: str, subtitle: str, action_progress=None):
    base = Image.new("RGBA", (WIDTH, HEIGHT), (239, 210, 212, 255))
    rounded_panel(base, (34, 28, 930, 692), (69, 37, 44, 115), 30)
    framed, rect = contain(source, (870, 635))
    x, y, w, h = rect
    base.alpha_composite(framed, (34 + x, 28 + y))
    rounded_panel(base, (974, 104, 1248, 520), (83, 42, 49, 225), 26, (249, 215, 150, 150), 2)
    text(base, (1008, 145), title, 25, (255, 241, 207, 255), True)
    text(base, (1008, 212), subtitle, 18, (255, 223, 211, 245), False, spacing=12)
    if action_progress is not None:
        # The path is a visual cue over the real game screenshot; the underlying
        # before/after positions are both captured from the live page.
        draw_arrow(base, (570, 488), (835, 295), action_progress)
        draw_glow_circle(base, (835, 295), 27, action_progress)
        text(base, (1008, 392), "推箱 · 找到星光位置", 21, (255, 227, 125, 255), True)
    return base


home = load_live("09-home-viewport.png")
level_before = load_live("01-level-top.png")
level_after = load_live("14-level-after-moves-top.png")
controls = load_live("11-level-after-up-viewport.png")
wardrobe = crop_wardrobe(rgba(FRAME_DIR / "07-wardrobe-full.png"))


def render(seconds: float) -> Image.Image:
    if seconds < 3.2:
        p = seconds / 3.2
        base = camera(home, p, 1.0, 1.10, (0.64, 0.46))
        veil = Image.new("RGBA", base.size, (69, 29, 45, 0))
        veil.putalpha(round(max(0.0, min(1.0, (1 - p) * 0.31)) * 255))
        base.alpha_composite(veil)
        panel_alpha = fade(min(1.0, p * 3.0))
        rounded_panel(base, (62, 498, 730, 664), (71, 35, 45, panel_alpha), 24)
        text(base, (94, 528), "衣橱深处，藏着一段星光传说", 29, (255, 244, 222, panel_alpha), True)
        text(base, (94, 583), "莉莉推开宝箱，冒险从第一格开始。", 21, (255, 220, 213, panel_alpha))
        return base

    if seconds < 6.2:
        p = (seconds - 3.2) / 3.0
        return board_scene(level_before, p, "第一关 · 阳光玩具房", "把宝箱推到发光的星光位置", None)

    if seconds < 10.6:
        p = (seconds - 6.2) / 4.4
        blend = ease(min(1.0, p * 1.15))
        before = board_scene(level_before, p, "每一步，都要想清楚", "箱子只能向前推，不能拉回来", ease(p))
        after = board_scene(level_after, p, "每一步，都要想清楚", "箱子只能向前推，不能拉回来", ease(p))
        # A wipe between two real gameplay states makes the push read as an action,
        # while preserving the actual board and character art from the live page.
        wipe = round(WIDTH * max(0.0, min(1.0, blend)))
        merged = before.copy()
        merged.paste(after.crop((0, 0, wipe, HEIGHT)), (0, 0), after.crop((0, 0, wipe, HEIGHT)))
        text(merged, (1008, 318), "↗", 48, (255, 224, 112, 255), True)
        return merged

    if seconds < 13.4:
        p = (seconds - 10.6) / 2.8
        base = camera(controls, p, 1.0, 1.08, (0.5, 0.7))
        rounded_panel(base, (55, 52, 610, 182), (67, 34, 45, fade(min(1.0, p * 3))), 24)
        text(base, (87, 80), "观察、规划、推动", 31, (255, 240, 213, 255), True)
        text(base, (87, 132), "不是快，而是刚刚好。", 22, (255, 218, 208, 255))
        ring_x = 650 + math.sin(p * math.pi * 2) * 18
        draw_glow_circle(base, (round(ring_x), 575), 30, p, (255, 211, 91, 230))
        return base

    if seconds < 17.1:
        p = (seconds - 13.4) / 3.7
        base = Image.new("RGBA", (WIDTH, HEIGHT), (238, 208, 214, 255))
        panel, rect = contain(wardrobe, (1120, 650))
        zoom = 0.90 + ease(p) * 0.10
        panel = panel.resize((round(panel.width * zoom), round(panel.height * zoom)), Image.Resampling.LANCZOS)
        px = (WIDTH - panel.width) // 2
        py = (HEIGHT - panel.height) // 2
        base.alpha_composite(panel, (px, py))
        rounded_panel(base, (56, 52, 460, 158), (70, 34, 46, fade(min(1.0, p * 3))), 23)
        text(base, (86, 78), "完成关卡，打开衣橱", 29, (255, 240, 212, 255), True)
        text(base, (86, 121), "每一件裙子，都是一次冒险的纪念。", 19, (255, 220, 211, 255))
        return base

    p = min(1.0, (seconds - 17.1) / 3.0)
    base = camera(home, p, 1.08, 1.0, (0.58, 0.5))
    rounded_panel(base, (56, 52, 665, 190), (69, 32, 44, fade(min(1.0, p * 3))), 24)
    text(base, (88, 80), "莉莉的衣橱冒险", 37, (255, 243, 220, 255), True)
    text(base, (90, 137), "70关 · 7个章节 · 10套衣橱收藏", 22, (255, 221, 210, 255))
    text(base, (90, 625), "现在，轮到你来推开下一扇门。", 25, (255, 244, 229, 245), True)
    return base


duration = 20.1
writer = cv2.VideoWriter(str(OUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
if not writer.isOpened():
    raise RuntimeError(f"Unable to open {OUT}")

for index in range(round(duration * FPS)):
    image = render(index / FPS).convert("RGB")
    frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    writer.write(frame)

writer.release()
print(f"Wrote {OUT}")
print(f"Resolution: {WIDTH}x{HEIGHT}, duration: {duration:.1f}s")
