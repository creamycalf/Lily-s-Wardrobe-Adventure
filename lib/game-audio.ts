type ToneType = OscillatorType;

const MUSIC_ASSET = "/audio/princess-castle-adventure.wav";

/** Plays a mastered, full-length fairytale score and keeps Web Audio only for
 * short interaction effects. This avoids the thin, repetitive oscillator
 * soundtrack used by the previous build. */
export class GameAudioEngine {
  private context: AudioContext | null = null;
  private effectsGain: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private chapterIndex = 0;
  private enabled = true;

  private getContext() {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;
    const AudioContextConstructor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    this.context = new AudioContextConstructor();
    this.effectsGain = this.context.createGain();
    this.effectsGain.gain.value = 0.38;
    this.effectsGain.connect(this.context.destination);
    return this.context;
  }

  private getMusic() {
    if (typeof window === "undefined") return null;
    if (this.music) return this.music;
    this.music = new Audio(MUSIC_ASSET);
    this.music.loop = true;
    this.music.preload = "auto";
    this.music.volume = 0.34;
    return this.music;
  }

  private tone(frequency: number, duration: number, volume: number, type: ToneType, delay = 0) {
    const context = this.getContext();
    if (!context || !this.effectsGain || !this.enabled) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.effectsGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private noise(duration: number, volume: number, delay = 0) {
    const context = this.getContext();
    if (!context || !this.effectsGain || !this.enabled) return;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const decay = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * decay;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(720, start);
    filter.Q.value = 0.7;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.effectsGain);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  start(chapterIndex = this.chapterIndex) {
    this.setChapter(chapterIndex);
    if (!this.enabled) return;
    const context = this.getContext();
    if (context) void context.resume();
    const music = this.getMusic();
    if (music?.paused) void music.play().catch(() => undefined);
  }

  setChapter(chapterIndex: number) {
    this.chapterIndex = Math.max(0, Math.min(6, Math.floor(chapterIndex)));
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    const music = this.getMusic();
    if (!enabled) {
      music?.pause();
      return;
    }
    this.start();
  }

  move(push: boolean) {
    this.start();
    if (push) {
      this.noise(0.13, 0.2);
      this.noise(0.08, 0.09, 0.045);
      this.tone(92, 0.18, 0.2, "triangle");
      this.tone(138, 0.15, 0.1, "sine", 0.028);
      return;
    }
    this.tone(523.25, 0.07, 0.05, "sine");
  }

  undo() {
    this.start();
    this.tone(392, 0.12, 0.08, "triangle");
    this.tone(262, 0.16, 0.05, "sine", 0.05);
  }

  success() {
    this.start();
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone(frequency, 0.26, 0.12, "sine", index * 0.1);
    });
  }

  dispose() {
    this.music?.pause();
    if (this.music) this.music.src = "";
    this.music = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.effectsGain = null;
  }
}
