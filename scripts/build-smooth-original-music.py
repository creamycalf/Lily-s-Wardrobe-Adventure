from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
OUTPUT = TMP / "source-music-smooth.wav"
SAMPLE_RATE = 48_000
TARGET_SECONDS = 26.88
TRANSITION_SECONDS = 1.0


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


def smooth_join(previous: np.ndarray, following: np.ndarray) -> np.ndarray:
    """Crossfade one second at a cut while preserving the original total duration."""
    half = round(TRANSITION_SECONDS * SAMPLE_RATE / 2)
    half = min(half, len(previous) // 2, len(following) // 2)
    previous_tail = resample(previous[-half:], half * 2)
    following_head = resample(following[:half], half * 2)
    position = np.linspace(0.0, 1.0, half * 2, dtype=np.float32)[:, None]
    curve = 0.5 - 0.5 * np.cos(np.pi * position)
    transition = previous_tail * (1.0 - curve) + following_head * curve
    return np.concatenate([previous[:-half], transition, following[half:]], axis=0)


def loop_to_length(source: np.ndarray, target_length: int) -> np.ndarray:
    """Extend a short tail without jumping back to the beginning of its song."""
    result = source
    while len(result) < target_length:
        result = smooth_join(result, source)
    return result[:target_length]


def build() -> None:
    pieces = [read_wave(TMP / f"source-audio-{index}.wav") for index in range(3)]
    board_tail = read_wave(TMP / "source-audio-board-tail.wav")
    # Keep the exact same source tail through the board, dress reveal, and real
    # home-screen promo ending. This removes the last audible music change.
    post_board_length = round((3.35 + 3.4 + 3.6) * SAMPLE_RATE)
    pieces.append(loop_to_length(board_tail, post_board_length))
    music = pieces[0]
    for piece in pieces[1:]:
        music = smooth_join(music, piece)

    target = round(TARGET_SECONDS * SAMPLE_RATE)
    if len(music) < target:
        music = np.pad(music, ((0, target - len(music)), (0, 0)), mode="constant")
    music = music[:target]

    fade_in = round(0.35 * SAMPLE_RATE)
    fade_out = round(1.2 * SAMPLE_RATE)
    music[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    music[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]

    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)
    write_wave(OUTPUT, music)
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {len(music) / SAMPLE_RATE:.2f}s")
    print("Music source is unchanged; only the transition regions were smoothed.")


if __name__ == "__main__":
    build()
