from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "video"
RUNTIME_DIR = ROOT / "tmp" / "video-stitch-runtime-clean"
GAME_FRAME_DIR = ROOT / "tmp" / "live-capture-frames"
OUTPUT = ROOT / "video-folder-story-cut-promo-clean-home-card.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 24
FADE_FRAMES = 10


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


def cover(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    scale = max(WIDTH / width, HEIGHT / height)
    resized = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    left = (resized.shape[1] - WIDTH) // 2
    top = (resized.shape[0] - HEIGHT) // 2
    return resized[top : top + HEIGHT, left : left + WIDTH]


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
            yield cover(frame)
            index += 1
    finally:
        capture.release()


def add_soft_vignette(frame: np.ndarray) -> np.ndarray:
    y, x = np.ogrid[:HEIGHT, :WIDTH]
    cx, cy = WIDTH / 2, HEIGHT / 2
    distance = ((x - cx) / (WIDTH * 0.72)) ** 2 + ((y - cy) / (HEIGHT * 0.78)) ** 2
    factor = np.clip(1.0 - np.maximum(0, distance - 0.28) * 0.32, 0.78, 1.0)
    return np.clip(frame.astype(np.float32) * factor[:, :, None], 0, 255).astype(np.uint8)


def decorate(frame: np.ndarray) -> np.ndarray:
    # The clean cut intentionally has no title cards or explanatory overlays.
    return add_soft_vignette(frame.copy())


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
    for index in range(count):
        alpha = (index + 1) / count
        writer.write(cv2.addWeighted(tail[index], 1 - alpha, head[index], alpha, 0))


def write_segment_tail(writer, segment_iter, tail: deque[np.ndarray]) -> deque[np.ndarray]:
    for raw in segment_iter:
        tail.append(decorate(raw))
        if len(tail) > FADE_FRAMES:
            writer.write(tail.popleft())
    return tail


def read_image(name: str) -> np.ndarray:
    image = cv2.imread(str(GAME_FRAME_DIR / name), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read game frame: {name}")
    return image


def board_canvas(image: np.ndarray, zoom: float = 1.0) -> np.ndarray:
    # These captures contain the actual game board. Cropping to the board creates
    # the requested overhead camera cut without adding any artificial UI text.
    crop = image[350:1015, 128:690]
    crop = cv2.resize(crop, (round(crop.shape[1] * zoom), round(crop.shape[0] * zoom)), interpolation=cv2.INTER_CUBIC)

    backdrop = cv2.resize(crop, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
    backdrop = cv2.GaussianBlur(backdrop, (0, 0), 24)
    backdrop = cv2.addWeighted(backdrop, 0.22, np.full_like(backdrop, (214, 181, 188)), 0.78, 0)
    canvas = backdrop

    scale = min((WIDTH - 110) / crop.shape[1], (HEIGHT - 38) / crop.shape[0])
    shown = cv2.resize(crop, (round(crop.shape[1] * scale), round(crop.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    x = (WIDTH - shown.shape[1]) // 2
    y = (HEIGHT - shown.shape[0]) // 2
    canvas[y : y + shown.shape[0], x : x + shown.shape[1]] = shown
    return canvas


def screen_canvas(image: np.ndarray, zoom: float = 1.0) -> np.ndarray:
    """Place a real game screen in a soft backdrop for the promotional end card."""
    backdrop = cover(image)
    backdrop = cv2.GaussianBlur(backdrop, (0, 0), 22)
    backdrop = cv2.addWeighted(backdrop, 0.18, np.full_like(backdrop, (224, 190, 198)), 0.82, 0)

    scale = min((WIDTH - 76) / image.shape[1], (HEIGHT - 24) / image.shape[0]) * zoom
    shown = cv2.resize(image, (round(image.shape[1] * scale), round(image.shape[0] * scale)), interpolation=cv2.INTER_CUBIC)
    x = (WIDTH - shown.shape[1]) // 2
    y = (HEIGHT - shown.shape[0]) // 2
    backdrop[y : y + shown.shape[0], x : x + shown.shape[1]] = shown
    return backdrop


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def game_action_frames():
    # The first two images are real before/after states of the same level: the
    # box moves upward, then the character moves beside it. The short blends and
    # camera push make the action read as a move instead of a static screenshot.
    initial = read_image("02-level-full.png")
    pushed = read_image("03-after-move.png")
    moved = read_image("04-move-1.png")

    for index in range(round(0.65 * FPS)):
        yield board_canvas(initial, 1.0 + 0.018 * index / (0.65 * FPS))

    for index in range(round(0.85 * FPS)):
        p = smoothstep((index + 1) / round(0.85 * FPS))
        before = board_canvas(initial, 1.015 + 0.055 * p)
        after = board_canvas(pushed, 1.015 + 0.055 * p)
        yield cv2.addWeighted(before, 1 - p, after, p, 0)

    for index in range(round(0.45 * FPS)):
        yield board_canvas(pushed, 1.07 - 0.018 * index / (0.45 * FPS))

    for index in range(round(0.75 * FPS)):
        p = smoothstep((index + 1) / round(0.75 * FPS))
        before = board_canvas(pushed, 1.052 - 0.022 * p)
        after = board_canvas(moved, 1.052 - 0.022 * p)
        yield cv2.addWeighted(before, 1 - p, after, p, 0)

    for index in range(round(0.65 * FPS)):
        yield board_canvas(moved, 1.03 - 0.015 * index / (0.65 * FPS))


def promotional_end_frames():
    # This is the real game home screen captured from the running game. It gives
    # the trailer a clear product ending without adding a fabricated title card.
    home = read_image("09-home-viewport-clean.png")
    for index in range(round(3.6 * FPS)):
        progress = index / max(1, round(3.6 * FPS) - 1)
        yield screen_canvas(home, 1.0 + 0.035 * smoothstep(progress))


def render() -> None:
    sources = make_ascii_sources()
    segments = [
        (get_frames(sources[0], 0.0, 5.4), "castle"),
        (get_frames(sources[1], 3.2, 8.7), "theft"),
        (get_frames(sources[2], 3.0, 8.6), "arrival"),
        (game_action_frames(), "game"),
        (get_frames(sources[3], 6.6, 10.0), "ending"),
        (promotional_end_frames(), "promo"),
    ]

    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError(f"Unable to open {OUTPUT}")

    pending_tail: list[np.ndarray] | None = None
    for segment_iter, _segment_name in segments:
        head_raw, segment_iter = read_first_frames(iter(segment_iter), FADE_FRAMES)
        head = [decorate(frame) for frame in head_raw]
        if pending_tail is not None:
            blend_transition(writer, pending_tail, head)
        tail = deque(head)
        tail = write_segment_tail(writer, segment_iter, tail)
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
    print("Note: OpenCV preview keeps the video image but cannot preserve source audio.")


if __name__ == "__main__":
    render()
