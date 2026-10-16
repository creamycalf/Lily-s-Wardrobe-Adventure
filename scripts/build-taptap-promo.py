from pathlib import Path
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS = 1280, 720, 24
OUTPUT = ROOT / "taptap-promo-20s.mp4"


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_TITLE = font(54, True)
FONT_SUBTITLE = font(25, False)
FONT_TAG = font(20, True)


def read_image(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    image = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    return np.asarray(image)


def with_copy(image: np.ndarray, title: str, subtitle: str, tag: str) -> np.ndarray:
    canvas = Image.fromarray(image.copy())
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((46, 42, 575, 198), radius=22, fill=(77, 40, 43, 164), outline=(255, 239, 220, 208), width=2)
    draw.text((72, 62), tag, font=FONT_TAG, fill=(255, 224, 175, 255))
    draw.text((70, 88), title, font=FONT_TITLE, fill=(255, 250, 238, 255), stroke_width=2, stroke_fill=(117, 55, 67, 210))
    draw.text((74, 154), subtitle, font=FONT_SUBTITLE, fill=(255, 245, 228, 255))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay)
    return np.asarray(canvas.convert("RGB"))


def make_segment(source: np.ndarray, title: str, subtitle: str, tag: str, seconds: float):
    prepared = with_copy(source, title, subtitle, tag)
    count = max(1, int(seconds * FPS))
    for index in range(count):
        progress = index / max(1, count - 1)
        scale = 1.0 + 0.025 * progress
        crop_w = int(WIDTH / scale)
        crop_h = int(HEIGHT / scale)
        left = (WIDTH - crop_w) // 2
        top = (HEIGHT - crop_h) // 2
        cropped = prepared[top:top + crop_h, left:left + crop_w]
        yield cv2.resize(cropped, (WIDTH, HEIGHT), interpolation=cv2.INTER_LINEAR)


def crossfade(previous: np.ndarray, current: np.ndarray, seconds: float = 0.45):
    count = max(1, int(seconds * FPS))
    for index in range(count):
        alpha = (index + 1) / count
        yield cv2.addWeighted(previous, 1.0 - alpha, current, alpha, 0)


def main():
    assets = {
        "home": read_image(ROOT / "taptap-screenshot-01-home.png"),
        "level": read_image(ROOT / "taptap-screenshot-02-level1.png"),
        "wardrobe": read_image(ROOT / "taptap-screenshot-03-wardrobe.png"),
        "map": read_image(ROOT / "taptap-screenshot-04-level-map.png"),
    }
    segments = [
        ("home", "莉莉的衣橱冒险", "70关推箱解谜 · 梦幻换装", "欢迎来到莉莉的衣橱" , 3.6),
        ("wardrobe", "解锁新裙子", "每一关，都是一件新的衣橱收藏", "收集星星，打开衣橱", 4.0),
        ("level", "推木箱，点亮星星", "移动宝箱到发光目标，开启下一关", "简单上手，步步解谜", 7.0),
        ("map", "70关挑战", "从阳光玩具房一路探索梦幻衣橱", "七章递进，难度逐渐提升", 3.8),
        ("home", "现在就开始冒险", "换上喜欢的裙子，陪莉莉完成衣橱旅程", "莉莉的衣橱冒险", 2.0),
    ]

    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError("无法创建 MP4 视频文件")

    previous_last = None
    for key, title, subtitle, tag, seconds in segments:
        frames = list(make_segment(assets[key], title, subtitle, tag, seconds))
        if previous_last is not None:
            for frame in crossfade(previous_last, frames[0]):
                writer.write(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
        for frame in frames:
            writer.write(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
        previous_last = frames[-1]

    writer.release()
    capture = cv2.VideoCapture(str(OUTPUT))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = capture.get(cv2.CAP_PROP_FPS)
    capture.release()
    duration = frame_count / fps if fps else 0
    print(f"created={OUTPUT}")
    print(f"size={OUTPUT.stat().st_size} bytes")
    print(f"dimensions={WIDTH}x{HEIGHT} fps={fps:.2f} frames={frame_count} duration={duration:.2f}s")


if __name__ == "__main__":
    main()
