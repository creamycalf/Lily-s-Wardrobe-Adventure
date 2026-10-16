from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
OUTPUT = TMP / "trailer-score-v8.wav"
SAMPLE_RATE = 48_000
TARGET_SECONDS = 26.875


def read_wave(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        if handle.getframerate() != SAMPLE_RATE or handle.getnchannels() != 2 or handle.getsampwidth() != 2:
            raise RuntimeError(f"Unexpected WAV format: {path}")
        raw = handle.readframes(handle.getnframes())
    return np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768.0


def write_wave(path: Path, audio: np.ndarray) -> None:
    pcm = np.clip(audio * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def resample(audio: np.ndarray, length: int) -> np.ndarray:
    if len(audio) == length:
        return audio.copy()
    old_x = np.linspace(0.0, 1.0, len(audio), dtype=np.float32)
    new_x = np.linspace(0.0, 1.0, length, dtype=np.float32)
    return np.stack([np.interp(new_x, old_x, audio[:, channel]) for channel in range(audio.shape[1])], axis=1)


def crossfade_keep_length(previous: np.ndarray, following: np.ndarray, seconds: float = 0.7) -> np.ndarray:
    half = round(seconds * SAMPLE_RATE / 2)
    half = min(half, len(previous) // 2, len(following) // 2)
    left = resample(previous[-half:], half * 2)
    right = resample(following[:half], half * 2)
    theta = np.linspace(0.0, np.pi / 2.0, half * 2, dtype=np.float32)[:, None]
    # Equal-power fade keeps perceived loudness steady through the join.
    transition = left * np.cos(theta) + right * np.sin(theta)
    return np.concatenate([previous[:-half], transition, following[half:]], axis=0)


def loop_to_length(source: np.ndarray, target_length: int) -> np.ndarray:
    result = source.copy()
    while len(result) < target_length:
        result = crossfade_keep_length(result, source, 0.55)
    return result[:target_length]


def slice_from_seconds(source: np.ndarray, start_seconds: float) -> np.ndarray:
    start = min(len(source) - 1, max(0, round(start_seconds * SAMPLE_RATE)))
    return source[start:]


def fade_boundary(board: np.ndarray, ending: np.ndarray) -> np.ndarray:
    """Resolve the level music before starting the story's closing theme."""
    board = board.copy()
    ending = ending.copy()
    board_fade = round(0.9 * SAMPLE_RATE)
    ending_fade = round(1.1 * SAMPLE_RATE)
    board[-board_fade:] *= np.linspace(1.0, 0.0, board_fade, dtype=np.float32)[:, None]
    ending[:ending_fade] *= np.linspace(0.0, 1.0, ending_fade, dtype=np.float32)[:, None]
    return np.concatenate([board, ending], axis=0)


def build() -> None:
    # Match the six visual parts in build-video-folder-montage-clean.py:
    # castle 5.4167s, theft 5.5s, arrival+board+dress 12.375s, home card 3.5833s.
    first = read_wave(TMP / "source-audio-0.wav")
    second = read_wave(TMP / "source-audio-1.wav")
    fourth = read_wave(TMP / "source-audio-4.wav")

    first_part = loop_to_length(first, round(5.4166667 * SAMPLE_RATE))
    second_part = loop_to_length(second, round(5.5 * SAMPLE_RATE))

    # From the third visual block all the way through the product ending, keep
    # one uninterrupted looping cue. This avoids another musical restart at
    # the board, dress reveal, or final home-screen card.
    third_to_end = loop_to_length(fourth, round((TARGET_SECONDS - 5.4166667 - 5.5) * SAMPLE_RATE))

    music = crossfade_keep_length(first_part, second_part, 0.75)
    music = crossfade_keep_length(music, third_to_end, 0.8)

    target = round(TARGET_SECONDS * SAMPLE_RATE)
    if len(music) < target:
        music = np.pad(music, ((0, target - len(music)), (0, 0)), mode="constant")
    music = music[:target]

    music[: round(0.35 * SAMPLE_RATE)] *= np.linspace(0.0, 1.0, round(0.35 * SAMPLE_RATE), dtype=np.float32)[:, None]
    music[-round(1.3 * SAMPLE_RATE) :] *= np.linspace(1.0, 0.0, round(1.3 * SAMPLE_RATE), dtype=np.float32)[:, None]
    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)
    write_wave(OUTPUT, music)
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {len(music) / SAMPLE_RATE:.2f}s")
    print("Arc: source-audio-0 -> source-audio-1 -> source-audio-4 loop through the ending")


if __name__ == "__main__":
    build()
