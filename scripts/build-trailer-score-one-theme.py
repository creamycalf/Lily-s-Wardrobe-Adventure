from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
OUTPUT = TMP / "trailer-score-one-theme.wav"
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


def crossfade_loop(source: np.ndarray, target_length: int, seconds: float = 1.15) -> np.ndarray:
    result = source.copy()
    half = round(seconds * SAMPLE_RATE / 2)
    while len(result) < target_length:
        half = min(half, len(result) // 2, len(source) // 2)
        left = result[-half:]
        right = source[:half]
        theta = np.linspace(0.0, np.pi / 2.0, half, dtype=np.float32)[:, None]
        transition = left * np.cos(theta) + right * np.sin(theta)
        result = np.concatenate([result[:-half], transition, source[half:]], axis=0)
    return result[:target_length]


def build() -> None:
    # One musical identity for the complete trailer. Gentle level changes
    # follow the story/game/end-card arc without introducing another cue.
    source = read_wave(TMP / "source-audio-main-full.wav")
    target = round(TARGET_SECONDS * SAMPLE_RATE)
    music = crossfade_loop(source, target)

    envelope = np.ones(target, dtype=np.float32)
    game_start = round(10.9 * SAMPLE_RATE)
    ending_start = round(19.9 * SAMPLE_RATE)
    rise = round(1.2 * SAMPLE_RATE)
    fall = round(1.3 * SAMPLE_RATE)
    envelope[game_start : game_start + rise] = np.linspace(0.9, 1.0, rise, dtype=np.float32)
    envelope[ending_start : ending_start + fall] = np.linspace(1.0, 0.92, fall, dtype=np.float32)
    envelope[-round(1.4 * SAMPLE_RATE) :] *= np.linspace(0.92, 0.0, round(1.4 * SAMPLE_RATE), dtype=np.float32)
    music *= envelope[:, None]
    music[: round(0.35 * SAMPLE_RATE)] *= np.linspace(0.0, 1.0, round(0.35 * SAMPLE_RATE), dtype=np.float32)[:, None]

    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)
    write_wave(OUTPUT, music)
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {len(music) / SAMPLE_RATE:.2f}s")
    print("Arc: one continuous main theme for story -> game -> ending")


if __name__ == "__main__":
    build()
