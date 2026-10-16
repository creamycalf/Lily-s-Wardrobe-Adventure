from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "promo-continuous-music.wav"
SAMPLE_RATE = 48_000
DURATION = 26.88
BPM = 96
BEAT = 60.0 / BPM


def hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def add_voice(mix: np.ndarray, start: float, duration: float, midi: float, amplitude: float, kind: str, pan: float = 0.0) -> None:
    start_index = max(0, round(start * SAMPLE_RATE))
    end_index = min(len(mix), round((start + duration) * SAMPLE_RATE))
    if end_index <= start_index:
        return

    t = np.arange(end_index - start_index, dtype=np.float32) / SAMPLE_RATE
    frequency = hz(midi)
    if kind == "pad":
        wave_data = (
            0.62 * np.sin(2 * np.pi * frequency * t)
            + 0.25 * np.sin(2 * np.pi * frequency * 2.0 * t)
            + 0.13 * np.sin(2 * np.pi * frequency * 0.5 * t)
        )
        attack = np.minimum(1.0, t / 0.35)
        release = np.minimum(1.0, (duration - t) / 0.45)
        envelope = np.clip(attack, 0.0, 1.0) * np.clip(release, 0.0, 1.0)
    elif kind == "pluck":
        wave_data = (
            0.72 * np.sin(2 * np.pi * frequency * t)
            + 0.22 * np.sin(2 * np.pi * frequency * 2.0 * t)
            + 0.06 * np.sin(2 * np.pi * frequency * 3.0 * t)
        )
        envelope = np.minimum(1.0, t / 0.008) * np.exp(-t / 0.26)
    elif kind == "bell":
        wave_data = (
            0.68 * np.sin(2 * np.pi * frequency * t)
            + 0.22 * np.sin(2 * np.pi * frequency * 2.01 * t)
            + 0.10 * np.sin(2 * np.pi * frequency * 3.98 * t)
        )
        envelope = np.minimum(1.0, t / 0.004) * np.exp(-t / 0.58)
    else:
        vibrato = 0.0025 * np.sin(2 * np.pi * 5.2 * t)
        wave_data = np.sin(2 * np.pi * frequency * (1.0 + vibrato) * t) + 0.18 * np.sin(2 * np.pi * frequency * 2.0 * t)
        attack = np.minimum(1.0, t / 0.018)
        release = np.minimum(1.0, (duration - t) / 0.16)
        envelope = np.clip(attack, 0.0, 1.0) * np.clip(release, 0.0, 1.0)

    mono = (wave_data * envelope * amplitude).astype(np.float32)
    left_gain = 1.0 - max(0.0, pan) * 0.24
    right_gain = 1.0 + min(0.0, pan) * 0.24
    mix[start_index:end_index, 0] += mono * left_gain
    mix[start_index:end_index, 1] += mono * right_gain


def write_music() -> None:
    total_samples = round(DURATION * SAMPLE_RATE)
    music = np.zeros((total_samples, 2), dtype=np.float32)

    # A single fairytale progression carries the complete story.
    progression = [
        (55, 59, 62),  # G
        (50, 54, 57),  # D
        (52, 55, 59),  # Em
        (48, 52, 55),  # C
        (55, 59, 62),  # G
        (50, 54, 57),  # D
        (52, 55, 59),  # Em
        (48, 52, 55),  # C
        (55, 59, 62),  # G
        (50, 54, 57),  # D
        (48, 52, 55),  # C
    ]

    for bar, chord in enumerate(progression):
        bar_start = bar * 4 * BEAT
        for note in chord:
            add_voice(music, bar_start, 4 * BEAT + 0.12, note, 0.035, "pad")

        # Gentle eighth-note harp pattern, panned very slightly for width.
        pattern = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12]
        for step in range(8):
            note = pattern[step % len(pattern)]
            add_voice(music, bar_start + step * BEAT / 2, 0.32, note, 0.075, "pluck", (-0.35 if step % 2 else 0.35))

        # Soft bass pulse anchors the rhythm without sounding percussive.
        for beat in range(4):
            add_voice(music, bar_start + beat * BEAT, 0.42, chord[0] - 12, 0.06, "pluck", 0.0)

    # Main melody: one recognizable phrase that develops toward the game home screen.
    melody_by_bar = [
        [67, 69, 71, 74],
        [71, 69, 67, 66],
        [64, 67, 69, 71],
        [74, 71, 69, 67],
        [67, 69, 71, 74],
        [76, 74, 71, 69],
        [71, 74, 76, 79],
        [78, 76, 74, 71],
        [79, 78, 76, 74],
        [71, 74, 76, 79],
        [79, 76, 74, 71],
    ]
    for bar, notes in enumerate(melody_by_bar):
        for beat, note in enumerate(notes):
            note_duration = 0.72 * BEAT if not (bar == len(melody_by_bar) - 1 and beat == 3) else 1.25 * BEAT
            add_voice(music, (bar * 4 + beat) * BEAT, note_duration, note, 0.105, "melody", -0.05)

    # A few star-like bells mark the wardrobe portal, the solved board, and the promo ending.
    for time, note in ((9.9, 86), (10.15, 90), (10.42, 93), (18.2, 86), (18.48, 90), (23.8, 91), (24.15, 95), (24.5, 98)):
        add_voice(music, time, 0.78, note, 0.085, "bell", 0.25)

    # Small room-like echo makes the synthetic instruments feel less dry.
    delay_a = round(0.16 * SAMPLE_RATE)
    delay_b = round(0.31 * SAMPLE_RATE)
    if delay_b < total_samples:
        music[delay_a:] += music[:-delay_a] * 0.075
        music[delay_b:] += music[:-delay_b] * 0.038

    fade_in = np.minimum(1.0, np.arange(total_samples, dtype=np.float32) / (0.45 * SAMPLE_RATE))
    fade_out = np.minimum(1.0, np.arange(total_samples - 1, -1, -1, dtype=np.float32) / (1.25 * SAMPLE_RATE))
    music *= (fade_in * fade_out)[:, None]
    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.82, -1.0, 1.0)

    pcm = (music * 32767.0).astype(np.int16)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {DURATION:.2f}s, sample rate: {SAMPLE_RATE}Hz")


if __name__ == "__main__":
    write_music()
