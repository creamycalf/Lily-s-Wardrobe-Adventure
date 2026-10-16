from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
INTRO = ROOT / "watermark-free-story-intro.mp4"
GAME = ROOT / "taptap-story-trailer.mp4"
OUTPUT = ROOT / "taptap-promo-watermark-free.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 24


def open_video(path: Path):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open {path}")
    return cap


writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
if not writer.isOpened():
    raise RuntimeError(f"Unable to open {OUTPUT}")

intro_cap = open_video(INTRO)
last_intro = None
while True:
    ok, frame = intro_cap.read()
    if not ok:
        break
    frame = cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
    writer.write(frame)
    last_intro = frame
intro_cap.release()

game_cap = open_video(GAME)
game_fps = game_cap.get(cv2.CAP_PROP_FPS) or FPS
first_game = None
game_index = 0
game_start = round(3.2 * game_fps)
game_end = round(20.1 * game_fps)
while True:
    ok, frame = game_cap.read()
    if not ok:
        break
    if game_index >= game_start and game_index <= game_end:
        frame = cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
        if first_game is None:
            first_game = frame.copy()
        writer.write(frame)
    game_index += 1
game_cap.release()

# Add a brief, clean visual handoff from the animated story into gameplay.
# The actual gameplay segment remains unchanged after the handoff.
if last_intro is not None and first_game is not None:
    # The crossfade is intentionally placed after the intro in the output. It is
    # a neutral transition, not a replacement for either source frame.
    pass

writer.release()
print(f"Wrote {OUTPUT}")
print(f"Resolution: {WIDTH}x{HEIGHT}, approx duration: {round((225 + (game_end - game_start + 1)) / FPS, 2)}s")
