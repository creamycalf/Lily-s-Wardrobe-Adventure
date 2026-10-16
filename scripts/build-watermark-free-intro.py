from pathlib import Path
import math
import random

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "tmp" / "imagegen"
OUTPUT = ROOT / "watermark-free-story-intro.mp4"
WIDTH, HEIGHT = 1280, 720
FPS = 24
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REGULAR = "C:/Windows/Fonts/msyh.ttc"


def load(name: str) -> Image.Image:
    return Image.open(ASSET_DIR / name).convert("RGBA")


def fit_cover(image: Image.Image) -> Image.Image:
    scale = max(WIDTH / image.width, HEIGHT / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - WIDTH) // 2
    top = (resized.height - HEIGHT) // 2
    return resized.crop((left, top, left + WIDTH, top + HEIGHT))


def camera(image: Image.Image, progress: float, focus: tuple[float, float], zoom_end: float) -> Image.Image:
    base = fit_cover(image)
    zoom = 1.0 + (zoom_end - 1.0) * progress
    scaled = base.resize((round(WIDTH * zoom), round(HEIGHT * zoom)), Image.Resampling.LANCZOS)
    max_x = scaled.width - WIDTH
    max_y = scaled.height - HEIGHT
    left = max(0, min(max_x, round(max_x / 2 + max_x * (focus[0] - 0.5) * 1.6)))
    top = max(0, min(max_y, round(max_y / 2 + max_y * (focus[1] - 0.5) * 1.6)))
    return scaled.crop((left, top, left + WIDTH, top + HEIGHT))


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def fnt(size: int, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size=size, index=0)


def alpha_text(base: Image.Image, xy, value, size, alpha=255, bold=False):
    draw = ImageDraw.Draw(base)
    draw.multiline_text(xy, value, font=fnt(size, bold), fill=(255, 244, 220, alpha), spacing=8)


def add_story_card(base: Image.Image, title: str, subtitle: str, progress: float):
    alpha = round(255 * min(1.0, max(0.0, progress * 4.0)))
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((54, 535, 760, 674), radius=24, fill=(55, 27, 42, round(alpha * 0.86)))
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.4))
    base.alpha_composite(overlay)
    alpha_text(base, (88, 562), title, 30, alpha, True)
    alpha_text(base, (88, 612), subtitle, 20, alpha)


def add_particles(base: Image.Image, progress: float, seed: int):
    rng = random.Random(seed)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(42):
        x = rng.randint(30, WIDTH - 30)
        y = rng.randint(25, HEIGHT - 30)
        phase = rng.random() * math.tau
        pulse = (math.sin(progress * math.tau * 1.4 + phase) + 1.0) / 2.0
        radius = 1 + round(pulse * 3)
        alpha = round(55 + pulse * 150)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 239, 167, alpha))
    base.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.8)))


def render_scene(image, progress, focus, zoom, title, subtitle, seed):
    base = camera(image, ease(progress), focus, zoom)
    add_particles(base, progress, seed)
    add_story_card(base, title, subtitle, progress)
    return base


castle = load("lily-castle-keyframe.png")
theft = load("lily-theft-keyframe.png")
portal = load("lily-portal-keyframe.png")
scenes = [
    (castle, 3.4, (0.30, 0.42), 1.10, "城堡里的小公主莉莉", "她守护着一座藏满梦幻裙子的衣橱。", 17),
    (theft, 3.4, (0.66, 0.48), 1.11, "可是，裙子被偷走了", "影子小狐狸把漂亮衣服带进了神秘的衣橱世界。", 29),
    (portal, 3.4, (0.55, 0.54), 1.09, "莉莉踏上冒险", "推动木箱，点亮星光位置，解锁所有衣橱收藏。", 41),
]
transition = 0.42
duration = sum(item[1] for item in scenes) - transition * (len(scenes) - 1)


def render_at(seconds: float) -> Image.Image:
    cursor = 0.0
    for index, (image, scene_duration, focus, zoom, title, subtitle, seed) in enumerate(scenes):
        start = cursor
        end = cursor + scene_duration
        local = seconds - start
        if seconds <= end or index == len(scenes) - 1:
            progress = max(0.0, min(1.0, local / scene_duration))
            current = render_scene(image, progress, focus, zoom, title, subtitle, seed)
            if index < len(scenes) - 1 and seconds > end - transition:
                next_image, next_duration, next_focus, next_zoom, next_title, next_subtitle, next_seed = scenes[index + 1]
                next_progress = max(0.0, min(1.0, (seconds - (end - transition)) / transition))
                upcoming = render_scene(next_image, next_progress, next_focus, next_zoom, next_title, next_subtitle, next_seed)
                return Image.blend(current, upcoming, ease(next_progress))
            return current
        cursor = end - transition
    return render_scene(scenes[-1][0], 1.0, scenes[-1][2], scenes[-1][3], scenes[-1][4], scenes[-1][5], scenes[-1][6])


writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
if not writer.isOpened():
    raise RuntimeError(f"Unable to open {OUTPUT}")

for frame_index in range(round(duration * FPS)):
    image = render_at(frame_index / FPS).convert("RGB")
    writer.write(cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR))

writer.release()
print(f"Wrote {OUTPUT}")
print(f"Resolution: {WIDTH}x{HEIGHT}, duration: {duration:.1f}s")
