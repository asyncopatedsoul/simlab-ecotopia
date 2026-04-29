/**
 * Audio playback layer (bd-engn.4).
 *
 * Three buses under a master gain:
 *   voice   — VO; ducks ambient while playing.
 *   sfx     — UI feedback + scene SFX.
 *   ambient — looping background tracks.
 *
 * Built on Web Audio API directly rather than Howler.js. Justification: the
 * 50ms-duck / 200ms-restore acceptance bar needs `AudioParam.linearRampTo
 * ValueAtTime` precision, and bus topology maps natively to GainNodes. Howler
 * abstracts these behind a JS volume layer that's not as deterministic.
 *
 * iOS silent-switch routing: Web Audio API bypasses the iOS mute switch by
 * default and routes to headphones when connected. This satisfies the
 * acceptance criterion's "audio still routes correctly to headphones" without
 * extra code. Physical-device validation is a follow-up bd issue.
 */

export type Bus = 'voice' | 'sfx' | 'ambient';

export type BusOrMaster = Bus | 'master';

export interface AudioPlayback {
  /** Resolves when the source ends naturally; rejects on stop(). */
  readonly ended: Promise<void>;
  /** Stop immediately. Idempotent. */
  stop(): void;
  /** Currently playing? */
  readonly isPlaying: boolean;
}

export type PlayOptions = {
  bus?: Bus;
  loop?: boolean;
  /** Per-source attenuation, multiplied with bus volume. 0..1. Default 1. */
  volume?: number;
};

export type DuckingConfig = {
  /** Volume to drop ambient to during voice playback. 0..1. Default 0.2. */
  ambientDuckedVolume: number;
  /** Linear ramp duration to duck the ambient bus, in seconds. Default 0.05. */
  duckRampSeconds: number;
  /** Linear ramp duration to restore the ambient bus, in seconds. Default 0.2. */
  restoreRampSeconds: number;
};

export type CreateAudioBusOptions = {
  /** Inject a context for tests; defaults to `new AudioContext()`. */
  audioContext?: AudioContext;
  /** Initial volumes per bus (0..1). Defaults: master=1, all buses=1. */
  initialVolume?: Partial<Record<BusOrMaster, number>>;
  ducking?: Partial<DuckingConfig>;
};

export interface AudioBusManager {
  readonly context: AudioContext;
  /** Decode an ArrayBuffer into an AudioBuffer. Async because decode is async. */
  decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer>;
  /** Play an AudioBuffer. Returns immediately; the playback handle resolves on end. */
  play(buffer: AudioBuffer, options?: PlayOptions): AudioPlayback;
  /** Set per-bus volume (0..1). 'master' attenuates the whole graph. */
  setVolume(bus: BusOrMaster, volume: number): void;
  /** Read current per-bus volume. */
  getVolume(bus: BusOrMaster): number;
  /** Stop all sources on a bus, or every bus if omitted. */
  stopAll(bus?: Bus): void;
  /** Resume the AudioContext after a user gesture (mobile autoplay rules). */
  resume(): Promise<void>;
  /** Close the context and release nodes. */
  destroy(): Promise<void>;
}
