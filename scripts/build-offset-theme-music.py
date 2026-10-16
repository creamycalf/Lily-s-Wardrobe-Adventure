from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
SOURCE = TMP / "source-audio-main-full.wav"
OUTPUT = TMP / "offset-theme-music-smooth-v2.wav"
SAMPLE_RATE = 48_000
TARGET_SECONDS = 26.88
CROSSFADE_SECONDS = 1.6


def read_wave(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        raw = handle.readframes(handle.getnframes())
        if handle.getframerate() != SAMPLE_RATE or handle.getnchannels() != 2 or handle.getsampwidth() != 2:
            raise RuntimeError(f"Unexpected WAV format: {path}")
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


def crossfade_keep_length(previous: np.ndarray, following: np.ndarray) -> np.ndarray:
    half = round(CROSSFADE_SECONDS * SAMPLE_RATE / 2)
    half = min(half, len(previous) // 2, len(following) // 2)
    previous_tail = resample(previous[-half:], half * 2)
    following_head = resample(following[:half], half * 2)
    theta = np.linspace(0.0, np.pi / 2.0, half * 2, dtype=np.float32)[:, None]
    transition = previous_tail * np.cos(theta) + following_head * np.sin(theta)
    return np.concatenate([previous[:-half], transition, following[half:]], axis=0)


def rotated(theme: np.ndarray, offset_seconds: float) -> np.ndarray:
    offset = round(offset_seconds * SAMPLE_RATE) % len(theme)
    # The offset join is itself crossfaded; otherwise the hidden loop point can
    # land exactly on the wardrobe-to-board visual transition.
    return crossfade_keep_length(theme[offset:], theme[:offset])


def build() -> None:
    theme = read_wave(SOURCE)
    target = round(TARGET_SECONDS * SAMPLE_RATE)

    # The opening uses the theme from its beginning. Subsequent passes begin at
    # middle offsets, so the melody never restarts at every visual clip cut.
    blocks = [
        theme,
        rotated(theme, 3.7),
        rotated(theme, 6.4),
        rotated(theme, 1.9),
    ]
    music = blocks[0]
    for block in blocks[1:]:
        music = crossfade_keep_length(music, block)
    music = music[:target]
    if len(music) < target:
        music = np.pad(music, ((0, target - len(music)), (0, 0)), mode="edge")

    fade_in = round(0.35 * SAMPLE_RATE)
    fade_out = round(1.45 * SAMPLE_RATE)
    music[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    music[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]
    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)
    write_wave(OUTPUT, music)
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {len(music) / SAMPLE_RATE:.2f}s")
    print("One theme with smoothed middle-offset joins: 0.0s -> 3.7s -> 6.4s -> 1.9s")


if __name__ == "__main__":
    build()
