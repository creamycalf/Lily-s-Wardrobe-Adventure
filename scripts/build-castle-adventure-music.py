"""Generate Lily's original loopable princess-castle waltz."""

from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/audio/princess-castle-adventure.wav"
RATE, BPM, BARS = 48_000, 144, 48
BEAT = 60.0 / BPM
EIGHTH, BAR = BEAT / 2, BEAT * 3
DURATION, FRAMES = BAR * BARS, round(BAR * BARS * RATE)
RNG = np.random.default_rng(20261006)


def midi(note: int) -> float:
    return 440.0 * 2.0 ** ((note - 69) / 12.0)


def env(length: int, attack: float, release: float, sustain: float = 1.0) -> np.ndarray:
    result = np.full(length, sustain, dtype=np.float32)
    a = min(length, max(1, round(attack * RATE)))
    r = min(length, max(1, round(release * RATE)))
    result[:a] = np.linspace(0, sustain, a, dtype=np.float32)
    result[-r:] *= np.linspace(1, 0, r, dtype=np.float32)
    return result


def place(mix: np.ndarray, start: float, sound: np.ndarray, pan: float = 0.0) -> None:
    """Place mono audio in a circular stereo buffer for a clean loop."""
    gains = (math.sqrt((1 - pan) * 0.5), math.sqrt((1 + pan) * 0.5))
    cursor, offset = round(start * RATE) % FRAMES, 0
    while offset < len(sound):
        count = min(len(sound) - offset, FRAMES - cursor)
        part = sound[offset:offset + count]
        mix[cursor:cursor + count, 0] += part * gains[0]
        mix[cursor:cursor + count, 1] += part * gains[1]
        offset, cursor = offset + count, 0


def voice(note: int, seconds: float, kind: str, level: float) -> np.ndarray:
    length = max(2, round(seconds * RATE))
    t = np.arange(length, dtype=np.float32) / RATE
    f, phase = midi(note), 2 * np.pi * midi(note) * t
    if kind == "harp":
        body = np.sin(phase) + .46*np.sin(2*phase) + .21*np.sin(3*phase) + .08*np.sin(5*phase)
        body = body*np.exp(-t*4.4) + RNG.normal(0, .05, length)*np.exp(-t*42)
        shape = env(length, .003, .10)
    elif kind == "celesta":
        body = np.sin(phase) + .30*np.sin(2.01*phase) + .16*np.sin(3.98*phase)
        body *= np.exp(-t*3.0)
        shape = env(length, .002, .16)
    elif kind == "flute":
        phase += (f / 5.2) * .003*np.sin(2*np.pi*5.2*t)
        body = np.sin(phase) + .17*np.sin(2*phase) + .05*np.sin(3*phase)
        body = body*(.96 + .04*np.sin(2*np.pi*4.1*t)) + RNG.normal(0, .015, length)
        shape = env(length, .075, .17, .92)
    elif kind == "strings":
        body = np.zeros(length, dtype=np.float32)
        for detune, weight in ((-.0032, .34), (0, .42), (.0037, .32)):
            p = phase*(1+detune) + .0022*f*np.sin(2*np.pi*4.7*t)
            body += weight*(np.sin(p) + .20*np.sin(2*p))
        shape = env(length, .10, .24, .88)
    elif kind == "horn":
        body = np.sin(phase) + .25*np.sin(2*phase) + .09*np.sin(3*phase)
        shape = env(length, .09, .22, .90)
    else:
        body = (np.sin(phase) + .30*np.sin(2*phase) + .08*np.sin(3*phase))*np.exp(-t*2.9)
        shape = env(length, .007, .12)
    return (body * shape * level).astype(np.float32)


def shimmer(level: float, seconds: float = .10) -> np.ndarray:
    length = round(seconds * RATE)
    t = np.arange(length, dtype=np.float32) / RATE
    noise = RNG.normal(0, 1, length).astype(np.float32)
    bright = noise - np.concatenate(([0.0], noise[:-1]))
    return (bright*(.76+.24*np.sin(2*np.pi*7600*t))*np.exp(-t*34)*level).astype(np.float32)


# Six harmonic eight-bar sections in B-flat major, with a wistful minor middle.
SECTIONS = [
    [(58,62,65),(57,60,65),(55,58,62),(53,57,60),(51,55,58),(50,58,62),(48,51,55),(53,57,60)],
    [(58,62,65),(53,57,60),(55,58,62),(50,53,57),(51,55,58),(58,62,65),(48,51,55),(53,57,60)],
    [(55,58,62),(50,53,57),(51,55,58),(58,62,65),(48,51,55),(55,58,62),(51,55,58),(53,57,60)],
    [(50,53,57),(55,58,62),(48,51,55),(53,57,60),(58,62,65),(51,55,58),(48,51,55),(53,57,60)],
    [(58,62,65),(57,60,65),(55,58,62),(53,57,60),(51,55,58),(50,58,62),(48,51,55),(53,57,60)],
    [(51,55,58),(50,58,62),(48,51,55),(53,57,60),(55,58,62),(51,55,58),(53,57,60),(58,62,65)],
]

# Each melody bar contains four lyrical notes: opening, two turns, resolution.
THEMES = [
    [(70,74,77,74),(72,69,72,77),(74,77,79,77),(74,72,69,74),
     (75,79,82,79),(77,74,70,74),(72,75,79,77),(76,77,81,77)],
    [(74,77,82,79),(77,76,77,84),(82,79,77,74),(72,74,77,81),
     (79,82,86,84),(82,81,79,77),(75,77,79,75),(74,76,77,81)],
    [(79,77,74,70),(69,72,74,77),(75,79,82,79),(77,74,70,74),
     (72,75,79,84),(82,79,77,74),(75,74,72,70),(72,76,77,81)],
]


def build() -> None:
    mix = np.zeros((FRAMES, 2), dtype=np.float32)
    positions, lengths = (0, 2, 3, 4), (2, 1, 1, 2)
    for bar in range(BARS):
        section, phrase_bar, start = bar // 8, bar % 8, bar * BAR
        chord = SECTIONS[section][phrase_bar]

        # Harp motion replaces the previous march rhythm.
        pattern = [chord[0]+12, chord[2]+12, chord[1]+12, chord[2]+12, chord[1]+12, chord[2]+12]
        for step, note in enumerate(pattern):
            place(mix, start+step*EIGHTH, voice(note, EIGHTH*1.35, "harp", .105), -.30+step*.04)

        # Elegant 3/4 pulse: bass on one, feather-light string chords on two and three.
        place(mix, start, voice(chord[0]-12, BEAT*1.15, "bass", .13), -.12)
        for beat_index in (1, 2):
            for i, note in enumerate(chord):
                place(mix, start+beat_index*BEAT, voice(note+12, BEAT*.82, "strings", .030), (i-1)*.36)
        if phrase_bar in (0, 4):
            for i, note in enumerate(chord):
                place(mix, start, voice(note+12, BAR*3.75, "strings", .020), (i-1)*.44)

        melody = THEMES[section % 3][phrase_bar]
        for index, note in enumerate(melody):
            pos, duration = positions[index], lengths[index]
            place(mix, start+pos*EIGHTH, voice(note, duration*EIGHTH*.98, "flute", .092), .20)
            if phrase_bar in (0, 3, 4, 7) and index in (0, 3):
                place(mix, start+pos*EIGHTH, voice(note+12, duration*EIGHTH*1.25, "celesta", .040), .38)

        if phrase_bar in (3, 7):
            for i, note in enumerate(chord):
                place(mix, start+2*BEAT, voice(note, BEAT*.90, "horn", .042), -.10+i*.10)
        for beat_index in (1, 2):
            place(mix, start+beat_index*BEAT, shimmer(.018), .44)
        if phrase_bar == 7:
            for step in range(6):
                place(mix, start+(3+step*.5)*EIGHTH, shimmer(.018+step*.003, .08), .36)

    for delay, gain in ((EIGHTH*1.5,.095),(EIGHTH*3,.052),(EIGHTH*5,.026)):
        mix += np.roll(mix.copy(), round(delay*RATE), axis=0)*gain
    mix -= np.mean(mix, axis=0, keepdims=True)
    mix = np.tanh(mix*1.16)
    mix *= .90 / float(np.max(np.abs(mix)))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(mix*32767, -32768, 32767).astype("<i2")
    with wave.open(str(OUTPUT), "wb") as handle:
        handle.setnchannels(2); handle.setsampwidth(2); handle.setframerate(RATE)
        handle.writeframes(pcm.tobytes())
    rms = float(np.sqrt(np.mean(mix*mix)))
    boundary = float(np.max(np.abs(mix[0]-mix[-1])))
    print(f"Wrote {OUTPUT}")
    print(f"style=princess castle waltz tempo={BPM} bpm meter=3/4 duration={DURATION:.2f}s")
    print(f"peak={np.max(np.abs(mix)):.4f} rms={rms:.4f} boundary_jump={boundary:.4f}")


if __name__ == "__main__":
    build()
