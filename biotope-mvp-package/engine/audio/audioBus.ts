import type {
  AudioBusManager,
  AudioPlayback,
  Bus,
  BusOrMaster,
  CreateAudioBusOptions,
  DuckingConfig,
  PlayOptions,
} from './types';

const DEFAULT_DUCKING: DuckingConfig = {
  ambientDuckedVolume: 0.2,
  duckRampSeconds: 0.05,
  restoreRampSeconds: 0.2,
};

class PlaybackHandle implements AudioPlayback {
  isPlaying = true;
  ended: Promise<void>;
  private resolveEnded!: () => void;
  private rejectEnded!: (reason: unknown) => void;
  private stopped = false;

  constructor(public readonly source: AudioBufferSourceNode) {
    this.ended = new Promise<void>((resolve, reject) => {
      this.resolveEnded = resolve;
      this.rejectEnded = reject;
    });
    source.onended = () => {
      if (!this.stopped) {
        this.isPlaying = false;
        this.resolveEnded();
      }
    };
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.isPlaying = false;
    try {
      this.source.stop();
    } catch {
      /* already stopped */
    }
    // Reject so callers awaiting `ended` know we stopped early. They can
    // .catch() to treat it as cancellation.
    this.rejectEnded(new DOMException('Playback stopped', 'AbortError'));
  }
}

export function createAudioBus(options: CreateAudioBusOptions = {}): AudioBusManager {
  const context = options.audioContext ?? new AudioContext();
  const ducking: DuckingConfig = { ...DEFAULT_DUCKING, ...options.ducking };

  const master = context.createGain();
  const voice = context.createGain();
  const sfx = context.createGain();
  const ambient = context.createGain();

  // Topology: bus → master → destination.
  voice.connect(master);
  sfx.connect(master);
  ambient.connect(master);
  master.connect(context.destination);

  const initial = options.initialVolume ?? {};
  const baseVolume: Record<BusOrMaster, number> = {
    master: initial.master ?? 1,
    voice: initial.voice ?? 1,
    sfx: initial.sfx ?? 1,
    ambient: initial.ambient ?? 1,
  };

  master.gain.value = baseVolume.master;
  voice.gain.value = baseVolume.voice;
  sfx.gain.value = baseVolume.sfx;
  ambient.gain.value = baseVolume.ambient;

  const busNode = (bus: BusOrMaster): GainNode => {
    switch (bus) {
      case 'master':
        return master;
      case 'voice':
        return voice;
      case 'sfx':
        return sfx;
      case 'ambient':
        return ambient;
    }
  };

  const activePlaybacks = new Set<PlaybackHandle>();
  const activeByBus: Record<Bus, Set<PlaybackHandle>> = {
    voice: new Set(),
    sfx: new Set(),
    ambient: new Set(),
  };
  let voiceActiveCount = 0;

  function ramp(param: AudioParam, target: number, durationSeconds: number): void {
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    if (durationSeconds <= 0) {
      param.setValueAtTime(target, now);
    } else {
      param.linearRampToValueAtTime(target, now + durationSeconds);
    }
  }

  function duckAmbient(): void {
    const target = baseVolume.ambient * ducking.ambientDuckedVolume;
    ramp(ambient.gain, target, ducking.duckRampSeconds);
  }

  function restoreAmbient(): void {
    ramp(ambient.gain, baseVolume.ambient, ducking.restoreRampSeconds);
  }

  return {
    context,

    async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
      // Some browsers still want the deprecated callback form; modern WebAudio
      // is Promise-returning. We rely on the Promise form.
      return context.decodeAudioData(arrayBuffer.slice(0));
    },

    play(buffer: AudioBuffer, opts: PlayOptions = {}): AudioPlayback {
      const bus: Bus = opts.bus ?? 'sfx';
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = opts.loop ?? false;

      // Optional per-source gain so callers can mix without touching bus volume.
      let connectFrom: AudioNode = source;
      if (opts.volume != null && opts.volume !== 1) {
        const sourceGain = context.createGain();
        sourceGain.gain.value = opts.volume;
        source.connect(sourceGain);
        connectFrom = sourceGain;
      }
      connectFrom.connect(busNode(bus));

      const handle = new PlaybackHandle(source);
      activePlaybacks.add(handle);
      activeByBus[bus].add(handle);

      if (bus === 'voice') {
        voiceActiveCount += 1;
        if (voiceActiveCount === 1) duckAmbient();
      }

      const cleanup = () => {
        activePlaybacks.delete(handle);
        activeByBus[bus].delete(handle);
        if (bus === 'voice') {
          voiceActiveCount = Math.max(0, voiceActiveCount - 1);
          if (voiceActiveCount === 0) restoreAmbient();
        }
      };
      handle.ended.then(cleanup, cleanup);

      try {
        source.start();
      } catch (e) {
        cleanup();
        throw e;
      }
      return handle;
    },

    setVolume(bus, volume) {
      const v = Math.max(0, Math.min(1, volume));
      baseVolume[bus] = v;
      if (bus === 'ambient' && voiceActiveCount > 0) {
        // Honor the duck while voice is active: the new "base" is what we'll
        // restore TO when voice ends, but for now the ambient gain stays
        // attenuated relative to the new base.
        const target = v * ducking.ambientDuckedVolume;
        ramp(ambient.gain, target, ducking.duckRampSeconds);
      } else {
        ramp(busNode(bus).gain, v, 0);
      }
    },

    getVolume(bus) {
      return baseVolume[bus];
    },

    stopAll(bus) {
      if (bus) {
        for (const h of [...activeByBus[bus]]) h.stop();
      } else {
        for (const h of [...activePlaybacks]) h.stop();
      }
    },

    async resume() {
      if (context.state === 'suspended') await context.resume();
    },

    async destroy() {
      this.stopAll();
      await context.close();
    },
  };
}
