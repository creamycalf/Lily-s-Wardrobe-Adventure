from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
OUTPUT = TMP / "trailer-score-scene-cues.wav"
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


def repeat_to_length(source: np.ndarray, target_length: int) -> np.ndarray:
    repeats = max(1, int(np.ceil(target_length / len(source))))
    return np.tile(source, (repeats, 1))[:target_length]


def build() -> None:
    # Visual cue lengths from build-video-folder-montage-clean.py. The music is
    # intentionally scene-based here, with direct cue changes between scenes.
    cue_plan = [
        ("source-audio-0.wav", 5.4166667),
        ("source-audio-1.wav", 5.5),
        ("source-audio-2.wav", 5.6),
        ("source-audio-3.wav", 3.375),
        ("source-audio-4.wav", 3.4166667),
        ("source-audio-5.wav", 3.5666666),
    ]

    pieces = [repeat_to_length(read_wave(TMP / name), round(seconds * SAMPLE_RATE)) for name, seconds in cue_plan]
    music = np.concatenate(pieces, axis=0)
    target = round(TARGET_SECONDS * SAMPLE_RATE)
    music = music[:target]
    music[: round(0.15 * SAMPLE_RATE)] *= np.linspace(0.0, 1.0, round(0.15 * SAMPLE_RATE), dtype=np.float32)[:, None]
    music[-round(0.7 * SAMPLE_RATE) :] *= np.linspace(1.0, 0.0, round(0.7 * SAMPLE_RATE), dtype=np.float32)[:, None]
    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)
    write_wave(OUTPUT, music)
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {len(music) / SAMPLE_RATE:.2f}s")
    print("Arc: source-audio-0 -> 1 -> 2 -> 3 -> 4 -> 5, scene-based direct cue changes")


if __name__ == "__main__":
    build()
