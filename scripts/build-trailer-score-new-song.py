from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "trailer-score-new-original-song.wav"
SAMPLE_RATE = 48_000
DURATION = 26.875
BPM = 112
BEAT = 60.0 / BPM
BAR = BEAT * 4.0


def hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def add_voice(
    mix: np.ndarray,
    start: float,
    duration: float,
    midi: float,
    amplitude: float,
    voice: str,
    pan: float = 0.0,
) -> None:
    start_index = max(0, round(start * SAMPLE_RATE))
    end_index = min(len(mix), round((start + duration) * SAMPLE_RATE))
    if end_index <= start_index:
        return

    t = np.arange(end_index - start_index, dtype=np.float32) / SAMPLE_RATE
    frequency = hz(midi)

    if voice == "warm_pad":
        phase = 2.0 * np.pi * frequency * t
        wave_data = (
            0.56 * np.sin(phase)
            + 0.19 * np.sin(phase * 2.0)
            + 0.10 * np.sin(phase * 3.0)
            + 0.15 * np.sin(phase * 0.5)
        )
        attack = np.clip(t / 0.35, 0.0, 1.0)
        release = np.clip((duration - t) / 0.55, 0.0, 1.0)
        envelope = attack * release
    elif voice == "piano":
        phase = 2.0 * np.pi * frequency * t
        wave_data = (
            0.70 * np.sin(phase)
            + 0.22 * np.sin(phase * 2.0)
            + 0.08 * np.sin(phase * 3.0)
        )
        envelope = np.clip(t / 0.008, 0.0, 1.0) * np.exp(-t / 0.72)
    elif voice == "celesta":
        phase = 2.0 * np.pi * frequency * t
        wave_data = (
            0.70 * np.sin(phase)
            + 0.22 * np.sin(phase * 2.73)
            + 0.08 * np.sin(phase * 4.16)
        )
        envelope = np.clip(t / 0.004, 0.0, 1.0) * np.exp(-t / 0.38)
    elif voice == "pizz":
        phase = 2.0 * np.pi * frequency * t
        wave_data = 0.78 * np.sin(phase) + 0.22 * np.sin(phase * 2.0)
        envelope = np.clip(t / 0.006, 0.0, 1.0) * np.exp(-t / 0.22)
    elif voice == "bass":
        phase = 2.0 * np.pi * frequency * t
        wave_data = 0.82 * np.sin(phase) + 0.18 * np.sin(phase * 2.0)
        envelope = np.clip(t / 0.015, 0.0, 1.0) * np.clip((duration - t) / 0.10, 0.0, 1.0)
    else:
        phase = 2.0 * np.pi * frequency * t
        vibrato = 0.0022 * np.sin(2.0 * np.pi * 5.1 * t)
        wave_data = np.sin(phase * (1.0 + vibrato)) + 0.13 * np.sin(phase * 2.0)
        envelope = np.clip(t / 0.018, 0.0, 1.0) * np.clip((duration - t) / 0.13, 0.0, 1.0)

    mono = (wave_data * envelope * amplitude).astype(np.float32)
    left_gain = 1.0 - max(0.0, pan) * 0.26
    right_gain = 1.0 + min(0.0, pan) * 0.26
    mix[start_index:end_index, 0] += mono * left_gain
    mix[start_index:end_index, 1] += mono * right_gain


def add_chord(mix: np.ndarray, start: float, chord: tuple[int, ...], level: float) -> None:
    for note in chord:
        add_voice(mix, start, BAR + 0.12, note, level, "warm_pad", -0.08 if note % 2 else 0.08)


def write_music() -> None:
    total_samples = round(DURATION * SAMPLE_RATE)
    music = np.zeros((total_samples, 2), dtype=np.float32)

    # New composition: a light storybook adventure in D major.
    # The same harmonic language runs through the whole film; instrumentation
    # grows at the puzzle section and resolves naturally into the end card.
    progression = [
        (62, 66, 69),  # D
        (57, 61, 64),  # A
        (59, 62, 66),  # Bm
        (55, 59, 62),  # G
        (62, 66, 69),  # D
        (57, 61, 64),  # A
        (59, 62, 66),  # Bm
        (55, 59, 62),  # G
        (64, 67, 71),  # Em7
        (55, 59, 62),  # G
        (62, 66, 69),  # D
        (57, 61, 64),  # A
    ]

    for bar, chord in enumerate(progression):
        start = bar * BAR
        growth = 0.78 + 0.10 * min(1.0, bar / 8.0)
        add_chord(music, start, chord, 0.027 * growth)

        # Soft eighth-note motion makes the board section feel active without
        # creating a hard music edit when the gameplay appears.
        pattern = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12]
        for step in range(8):
            note = pattern[step % len(pattern)]
            add_voice(
                music,
                start + step * BEAT / 2.0,
                0.24,
                note,
                0.047 * growth,
                "pizz",
                -0.28 if step % 2 else 0.28,
            )

        # Warm low pulse keeps the song grounded through the story and puzzle.
        for beat in range(4):
            add_voice(music, start + beat * BEAT, 0.34, chord[0] - 12, 0.045 * growth, "bass")

    # Distinct new melody: a rising wardrobe motif, then a playful answer.
    melody = [
        [74, 76, 78, 81, 78, 76, 74, 73],
        [74, 76, 78, 81, 83, 81, 78, 76],
        [74, 73, 71, 69, 71, 73, 74, 76],
        [78, 76, 74, 73, 71, 73, 74, 76],
        [74, 76, 78, 81, 78, 76, 74, 73],
        [74, 76, 78, 81, 83, 85, 83, 81],
        [78, 76, 74, 76, 78, 81, 83, 81],
        [78, 76, 74, 73, 71, 73, 74, 76],
        [76, 78, 81, 83, 81, 78, 76, 74],
        [74, 76, 78, 81, 83, 81, 78, 76],
        [74, 76, 78, 81, 83, 86, 85, 83],
        [81, 78, 76, 74, 73, 74, 76, 74],
    ]
    for bar, notes in enumerate(melody):
        start = bar * BAR
        for step, note in enumerate(notes):
            add_voice(
                music,
                start + step * BEAT / 2.0,
                0.34 if step < 7 else 0.50,
                note,
                0.078 if bar < 4 else 0.092,
                "celesta" if bar < 4 else "melody",
                0.14 if step % 2 else -0.14,
            )

    # Pizzicato answer motif during the puzzle section, not a separate cue.
    for bar in range(4, 9):
        start = bar * BAR
        for step, note in enumerate((66, 69, 73, 76)):
            add_voice(music, start + (step * 2 + 1) * BEAT / 2.0, 0.18, note, 0.031, "pizz", -0.12)

    # Small sparkle accents are part of the composition's cadence, not edits.
    for time, note in ((8.62, 90), (8.90, 93), (17.18, 90), (17.44, 95), (24.55, 90), (24.82, 93), (25.10, 98)):
        add_voice(music, time, 0.62, note, 0.052, "celesta", 0.22)

    # Gentle room reflections keep the single song continuous and soften joins.
    delay_a = round(0.17 * SAMPLE_RATE)
    delay_b = round(0.33 * SAMPLE_RATE)
    music[delay_a:] += music[:-delay_a] * 0.065
    music[delay_b:] += music[:-delay_b] * 0.030

    fade_in = np.clip(np.arange(total_samples, dtype=np.float32) / (0.42 * SAMPLE_RATE), 0.0, 1.0)
    fade_out = np.clip(np.arange(total_samples - 1, -1, -1, dtype=np.float32) / (1.35 * SAMPLE_RATE), 0.0, 1.0)
    music *= (fade_in * fade_out)[:, None]

    peak = float(np.max(np.abs(music))) or 1.0
    music = np.clip(music / peak * 0.78, -1.0, 1.0)
    pcm = (music * 32767.0).astype(np.int16)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())
    print(f"Wrote {OUTPUT}")
    print(f"Duration: {DURATION:.3f}s, BPM: {BPM}, key: D major")


if __name__ == "__main__":
    write_music()
