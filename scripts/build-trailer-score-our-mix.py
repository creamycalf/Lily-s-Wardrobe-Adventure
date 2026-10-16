from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
OUTPUT = TMP / "trailer-score-our-mix.wav"
SAMPLE_RATE = 48_000
TARGET_SECONDS = 26.875
ENDING_START_SECONDS = 23.2916667


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


def crossfade_keep_length(previous: np.ndarray, following: np.ndarray, seconds: float) -> np.ndarray:
    half = round(seconds * SAMPLE_RATE / 2)
    half = min(half, len(previous) // 2, len(following) // 2)
    left = resample(previous[-half:], half * 2)
    right = resample(following[:half], half * 2)
    theta = np.linspace(0.0, np.pi / 2.0, half * 2, dtype=np.float32)[:, None]
    transition = left * np.cos(theta) + right * np.sin(theta)
    return np.concatenate([previous[:-half], transition, following[half:]], axis=0)


def loop_to_length(source: np.ndarray, target_length: int, crossfade_seconds: float) -> np.ndarray:
    result = source.copy()
    while len(result) < target_length:
        result = crossfade_keep_length(result, source, crossfade_seconds)
    return result[:target_length]


def build() -> None:
    # The first full theme is the musical identity the user preferred. Keep it
    # running through the story, board action, and dress reveal as one cue.
    main_theme = read_wave(TMP / "source-audio-main-full.wav")
    outro_theme = read_wave(TMP / "source-audio-4.wav")

    main_length = round(ENDING_START_SECONDS * SAMPLE_RATE)
    outro_length = round((TARGET_SECONDS - ENDING_START_SECONDS) * SAMPLE_RATE)
    main_part = loop_to_length(main_theme, main_length, 1.15)
    outro_part = loop_to_length(outro_theme, outro_length, 0.75)

    music = crossfade_keep_length(main_part, outro_part, 1.45)
    target = round(TARGET_SECONDS * SAMPLE_RATE)
    music = music[:target]
    music[: round(0.35 * SAMPLE_RATE)] *= np.linspace(0.0, 1.0, round(0.35 * SAMPLE_RATE), dtype=np.float32)[:, None]
    music[-round(1.3 * SAMPLE_RATE) :] *= np.linspace(1.0, 0.0, round(1.3 * SAMPLE_RATE), dtype=np.float32)[:, None]

    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)
    write_wave(OUTPUT, music)
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {len(music) / SAMPLE_RATE:.2f}s")
    print("Arc: one continuous main theme through the story/game -> long outro crossfade")


if __name__ == "__main__":
    build()
