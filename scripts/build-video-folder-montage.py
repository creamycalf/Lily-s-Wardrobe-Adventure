from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "video"
RUNTIME_DIR = ROOT / "tmp" / "video-stitch-runtime"
GAME_SOURCE = ROOT / "taptap-story-trailer.mp4"
OUTPUT = ROOT / "video-folder-story-cut.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 24
FADE_FRAMES = 10
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def make_ascii_sources() -> list[Path]:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(SOURCE_DIR.glob("*.mp4"), key=lambda p: p.name)
    if len(sources) < 4:
        raise RuntimeError(f"Expected at least four videos in {SOURCE_DIR}, found {len(sources)}")
    copied: list[Path] = []
    for index, source in enumerate(sources[:4], 1):
        target = RUNTIME_DIR / f"source-{index}.mp4"
        shutil.copy2(source, target)
        copied.append(target)
    return copied


def open_capture(path: Path) -> cv2.VideoCapture:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Unable to open video: {path}")
    return capture


def get_frames(path: Path, start_seconds: float, end_seconds: float):
    capture = open_capture(path)
    source_fps = capture.get(cv2.CAP_PROP_FPS) or FPS
    start = max(0, round(start_seconds * source_fps))
    end = max(start + 1, round(end_seconds * source_fps))
    capture.set(cv2.CAP_PROP_POS_FRAMES, start)
    index = start
    try:
        while index < end:
            ok, frame = capture.read()
            if not ok:
                break
            if frame.shape[1] != WIDTH or frame.shape[0] != HEIGHT:
                frame = cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
            yield frame
            index += 1
    finally:
        capture.release()


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size=size)


def title_overlay(frame: np.ndarray, title: str, subtitle: str, alpha: float = 0.86) -> None:
    overlay = frame.copy()
    cv2.rectangle(overlay, (48, 48), (760, 175), (42, 27, 45), -1)
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, dst=frame)
    canvas = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(canvas)
    draw.text((77, 69), title, font=font(32, True), fill=(255, 246, 223), stroke_width=2, stroke_fill=(62, 31, 47))
    draw.text((77, 120), subtitle, font=font(21), fill=(255, 224, 192), stroke_width=1, stroke_fill=(62, 31, 47))
    frame[:] = cv2.cvtColor(np.asarray(canvas), cv2.COLOR_RGB2BGR)


def add_soft_vignette(frame: np.ndarray) -> None:
    y, x = np.ogrid[:HEIGHT, :WIDTH]
    cx, cy = WIDTH / 2, HEIGHT / 2
    distance = ((x - cx) / (WIDTH * 0.72)) ** 2 + ((y - cy) / (HEIGHT * 0.78)) ** 2
    factor = np.clip(1.0 - np.maximum(0, distance - 0.28) * 0.32, 0.78, 1.0)
    frame[:] = np.clip(frame.astype(np.float32) * factor[:, :, None], 0, 255).astype(np.uint8)


def decorate(frame: np.ndarray, segment: str, local_index: int) -> np.ndarray:
    frame = frame.copy()
    seconds = local_index / FPS
    if segment == "castle" and seconds < 2.8:
        title_overlay(frame, "城堡里的小公主莉莉", "漂亮的衣服，藏着一个梦幻的秘密。")
    elif segment == "theft" and seconds < 2.2:
        title_overlay(frame, "影子小狐狸偷走了衣服", "莉莉追进神秘的衣橱世界。")
    elif segment == "puzzle" and seconds < 2.4:
        title_overlay(frame, "进入衣橱世界", "推箱子、点亮星光，解锁新的衣服。")
    elif segment == "dress" and seconds < 1.8:
        title_overlay(frame, "每一件衣服，都是一次冒险", "找回裙子，完成莉莉的梦幻收藏。")
    elif segment == "game" and seconds < 1.4:
        title_overlay(frame, "真实游戏玩法", "推箱子解谜，打开衣橱收藏。")
    add_soft_vignette(frame)
    return frame


def write_segment_tail(writer, segment_iter, segment_name: str, tail: deque[np.ndarray]) -> deque[np.ndarray]:
    local_index = 0
    for raw in segment_iter:
        frame = decorate(raw, segment_name, local_index)
        local_index += 1
        tail.append(frame)
        if len(tail) > FADE_FRAMES:
            writer.write(tail.popleft())
    return tail


def read_first_frames(segment_iter, count: int) -> tuple[list[np.ndarray], object]:
    frames: list[np.ndarray] = []
    for _ in range(count):
        try:
            frames.append(next(segment_iter))
        except StopIteration:
            break
    return frames, segment_iter


def blend_transition(writer, tail: list[np.ndarray], head: list[np.ndarray]) -> None:
    count = min(len(tail), len(head))
    for i in range(count):
        alpha = (i + 1) / count
        mixed = cv2.addWeighted(tail[i], 1 - alpha, head[i], alpha, 0)
        writer.write(mixed)


def render() -> None:
    sources = make_ascii_sources()
    segments = [
        ("castle", sources[0], 0.0, 6.0),
        ("theft", sources[1], 3.2, 9.0),
        ("puzzle", sources[2], 2.0, 8.0),
        ("dress", sources[3], 2.0, 7.0),
        ("game", GAME_SOURCE, 3.2, 7.2),
    ]
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError(f"Unable to open {OUTPUT}")

    pending_tail: list[np.ndarray] | None = None
    for segment_name, source, start, end in segments:
        segment_iter = iter(get_frames(source, start, end))
        head_raw, segment_iter = read_first_frames(segment_iter, FADE_FRAMES)
        head = [decorate(frame, segment_name, i) for i, frame in enumerate(head_raw)]
        if pending_tail is not None:
            blend_transition(writer, pending_tail, head)
        # Keep the last FADE_FRAMES in memory so the next segment can crossfade.
        # Do not use deque(maxlen=...) here: it would discard the oldest frame
        # before the explicit write below, leaving only transition frames.
        tail = deque(head)
        tail = write_segment_tail(writer, segment_iter, segment_name, tail)
        pending_tail = list(tail)
    if pending_tail:
        for frame in pending_tail:
            writer.write(frame)
    writer.release()

    capture = open_capture(OUTPUT)
    fps = capture.get(cv2.CAP_PROP_FPS) or FPS
    frames = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    capture.release()
    print(f"Wrote {OUTPUT}")
    print(f"Resolution: {width}x{height}, duration: {frames / fps:.2f}s")
    print("Note: OpenCV preview keeps the video image but cannot preserve source audio; audio will be muxed once FFmpeg is available.")


if __name__ == "__main__":
    render()
