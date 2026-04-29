import { describe, expect, it } from 'vitest';
import { createAudioBus } from './audioBus';
import type { AudioBusManager } from './types';

// ── Fake Web Audio surface, sufficient for createAudioBus's calls. ──────────

type ParamEvent =
  | { type: 'setValue'; value: number; time: number }
  | { type: 'linearRamp'; value: number; time: number }
  | { type: 'cancel'; time: number };

class FakeAudioParam {
  value: number;
  events: ParamEvent[] = [];
  constructor(initial: number) {
    this.value = initial;
  }
  setValueAtTime(value: number, time: number) {
    this.events.push({ type: 'setValue', value, time });
    this.value = value;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'linearRamp', value, time });
  }
  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time });
    this.events = this.events.filter((e) => e.type === 'cancel' || e.time < time);
  }
}

class FakeGainNode {
  readonly kind = 'gain';
  readonly gain: FakeAudioParam;
  readonly outgoing: FakeNode[] = [];
  constructor(initial = 1) {
    this.gain = new FakeAudioParam(initial);
  }
  connect(node: FakeNode) {
    this.outgoing.push(node);
  }
  disconnect() {
    this.outgoing.length = 0;
  }
}

class FakeBufferSourceNode {
  readonly kind = 'source';
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;
  readonly outgoing: FakeNode[] = [];
  start(when?: number) {
    this.startedAt = when ?? 0;
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    queueMicrotask(() => this.onended?.());
  }
  connect(node: FakeNode) {
    this.outgoing.push(node);
  }
  /** Test helper: simulate buffer reaching end naturally. */
  finishNaturally() {
    if (this.stopped) return;
    this.stopped = true;
    queueMicrotask(() => this.onended?.());
  }
}

type FakeNode = FakeGainNode | FakeBufferSourceNode | { kind: 'destination' };

class FakeAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' = 'running';
  readonly destination: { kind: 'destination' } = { kind: 'destination' };
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeBufferSourceNode[] = [];

  createGain() {
    const g = new FakeGainNode();
    this.gains.push(g);
    return g;
  }
  createBufferSource() {
    const s = new FakeBufferSourceNode();
    this.sources.push(s);
    return s;
  }
  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 1, length: 44100, numberOfChannels: 1, sampleRate: 44100, _bytes: buffer.byteLength } as unknown as AudioBuffer);
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }

  // Test helper.
  advanceTime(delta: number) {
    this.currentTime += delta;
  }
}

function makeBus(ctxOverrides?: Partial<FakeAudioContext>) {
  const ctx = new FakeAudioContext();
  if (ctxOverrides) Object.assign(ctx, ctxOverrides);
  const audio = createAudioBus({ audioContext: ctx as unknown as AudioContext });
  // Index conventions tied to createAudioBus's createGain order.
  const [master, voice, sfx, ambient] = ctx.gains;
  if (!master || !voice || !sfx || !ambient) {
    throw new Error('FakeAudioContext gains were not created in expected order');
  }
  return { ctx, audio, master, voice, sfx, ambient };
}

function makeBuffer(): AudioBuffer {
  return {} as AudioBuffer;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createAudioBus — topology', () => {
  it('connects voice/sfx/ambient → master → destination', () => {
    const { master, voice, sfx, ambient, ctx } = makeBus();
    expect(voice.outgoing).toContain(master);
    expect(sfx.outgoing).toContain(master);
    expect(ambient.outgoing).toContain(master);
    expect(master.outgoing).toContain(ctx.destination);
  });

  it('honors initial volumes', () => {
    const ctx = new FakeAudioContext();
    const audio = createAudioBus({
      audioContext: ctx as unknown as AudioContext,
      initialVolume: { master: 0.5, voice: 0.8, ambient: 0.6, sfx: 0.7 },
    });
    expect(audio.getVolume('master')).toBe(0.5);
    expect(audio.getVolume('voice')).toBe(0.8);
    expect(audio.getVolume('ambient')).toBe(0.6);
    expect(audio.getVolume('sfx')).toBe(0.7);
    expect(ctx.gains[0]?.gain.value).toBe(0.5);
    expect(ctx.gains[1]?.gain.value).toBe(0.8);
    expect(ctx.gains[2]?.gain.value).toBe(0.7);
    expect(ctx.gains[3]?.gain.value).toBe(0.6);
  });
});

describe('createAudioBus — playback routing', () => {
  it('plays a buffer onto the requested bus', () => {
    const { audio, ctx, sfx } = makeBus();
    audio.play(makeBuffer(), { bus: 'sfx' });
    const source = ctx.sources[0]!;
    expect(source.startedAt).not.toBeNull();
    expect(source.outgoing).toContain(sfx);
  });

  it('default bus is sfx', () => {
    const { audio, ctx, sfx } = makeBus();
    audio.play(makeBuffer());
    expect(ctx.sources[0]!.outgoing).toContain(sfx);
  });

  it('per-source volume routes through an extra gain stage', () => {
    const { audio, ctx, sfx } = makeBus();
    audio.play(makeBuffer(), { bus: 'sfx', volume: 0.3 });
    // After the four bus gains comes a per-source gain.
    const sourceGain = ctx.gains[4];
    expect(sourceGain).toBeDefined();
    expect(sourceGain!.gain.value).toBe(0.3);
    expect(ctx.sources[0]!.outgoing).toContain(sourceGain);
    expect(sourceGain!.outgoing).toContain(sfx);
  });
});

describe('createAudioBus — ducking (acceptance)', () => {
  it('ramps ambient down to 0.2 within 50ms when voice starts', () => {
    const { audio, ctx, ambient } = makeBus();
    ctx.advanceTime(1.0); // pretend some time has passed
    audio.play(makeBuffer(), { bus: 'voice' });
    const last = ambient.gain.events.at(-1)!;
    expect(last).toMatchObject({
      type: 'linearRamp',
      value: 0.2,
      time: 1.05, // currentTime + 0.05
    });
  });

  it('ramps ambient back up within 200ms when voice ends', async () => {
    const { audio, ctx, ambient } = makeBus();
    audio.play(makeBuffer(), { bus: 'voice' });
    const duckEventCount = ambient.gain.events.length;
    ctx.advanceTime(2.5);
    ctx.sources[0]!.finishNaturally();
    await Promise.resolve();
    await Promise.resolve();
    const restore = ambient.gain.events.at(-1)!;
    expect(ambient.gain.events.length).toBeGreaterThan(duckEventCount);
    expect(restore).toMatchObject({
      type: 'linearRamp',
      value: 1, // back to ambient base volume
      time: 2.5 + 0.2,
    });
  });

  it('keeps ambient ducked while ANY voice is playing (multiple overlap)', async () => {
    const { audio, ctx, ambient } = makeBus();
    audio.play(makeBuffer(), { bus: 'voice' });
    audio.play(makeBuffer(), { bus: 'voice' });
    const eventsBefore = ambient.gain.events.length;
    // First voice ends.
    ctx.sources[0]!.finishNaturally();
    await Promise.resolve();
    await Promise.resolve();
    // No restore yet.
    expect(ambient.gain.events.length).toBe(eventsBefore);
    // Second voice ends; now restore fires.
    ctx.sources[1]!.finishNaturally();
    await Promise.resolve();
    await Promise.resolve();
    expect(ambient.gain.events.length).toBeGreaterThan(eventsBefore);
    expect(ambient.gain.events.at(-1)!).toMatchObject({ type: 'linearRamp', value: 1 });
  });

  it('uses configured ambient base volume as the restore target', async () => {
    const ctx = new FakeAudioContext();
    const audio = createAudioBus({
      audioContext: ctx as unknown as AudioContext,
      initialVolume: { ambient: 0.6 },
    });
    const ambient = ctx.gains[3]!;
    audio.play(makeBuffer(), { bus: 'voice' });
    const duck = ambient.gain.events.at(-1)!;
    expect(duck).toMatchObject({ type: 'linearRamp', value: 0.6 * 0.2 });
    ctx.sources[0]!.finishNaturally();
    await Promise.resolve();
    await Promise.resolve();
    const restore = ambient.gain.events.at(-1)!;
    expect(restore).toMatchObject({ type: 'linearRamp', value: 0.6 });
  });

  it('honors custom ducking config', () => {
    const ctx = new FakeAudioContext();
    const audio = createAudioBus({
      audioContext: ctx as unknown as AudioContext,
      ducking: { ambientDuckedVolume: 0.05, duckRampSeconds: 0.02, restoreRampSeconds: 0.1 },
    });
    const ambient = ctx.gains[3]!;
    audio.play(makeBuffer(), { bus: 'voice' });
    const duck = ambient.gain.events.at(-1)!;
    expect(duck).toMatchObject({ type: 'linearRamp', value: 0.05, time: 0.02 });
  });

  it('non-voice playback never ducks ambient', () => {
    const { audio, ambient } = makeBus();
    const eventsBefore = ambient.gain.events.length;
    audio.play(makeBuffer(), { bus: 'sfx' });
    audio.play(makeBuffer(), { bus: 'ambient', loop: true });
    expect(ambient.gain.events.length).toBe(eventsBefore);
  });
});

describe('createAudioBus — volume control', () => {
  it('setVolume clamps to [0,1] and updates the bus gain', () => {
    const { audio, voice } = makeBus();
    audio.setVolume('voice', 1.5);
    expect(audio.getVolume('voice')).toBe(1);
    audio.setVolume('voice', -0.2);
    expect(audio.getVolume('voice')).toBe(0);
    audio.setVolume('voice', 0.4);
    expect(audio.getVolume('voice')).toBe(0.4);
    expect(voice.gain.events.at(-1)).toMatchObject({ type: 'setValue', value: 0.4 });
  });

  it('setVolume on ambient during voice playback keeps it ducked', () => {
    const { audio, ctx, ambient } = makeBus();
    audio.play(makeBuffer(), { bus: 'voice' });
    audio.setVolume('ambient', 0.5);
    const last = ambient.gain.events.at(-1)!;
    expect(last).toMatchObject({ type: 'linearRamp', value: 0.5 * 0.2 });
    void ctx;
  });
});

describe('createAudioBus — stop', () => {
  it('stopAll(bus) stops only that bus', async () => {
    const { audio, ctx } = makeBus();
    const a = audio.play(makeBuffer(), { bus: 'voice' });
    const b = audio.play(makeBuffer(), { bus: 'sfx' });
    audio.stopAll('sfx');
    await Promise.resolve();
    await Promise.resolve();
    expect(b.isPlaying).toBe(false);
    expect(a.isPlaying).toBe(true);
    expect(ctx.sources[0]!.stopped).toBe(false);
    expect(ctx.sources[1]!.stopped).toBe(true);
  });

  it('stopAll() stops everything', async () => {
    const { audio, ctx } = makeBus();
    audio.play(makeBuffer(), { bus: 'voice' });
    audio.play(makeBuffer(), { bus: 'sfx' });
    audio.play(makeBuffer(), { bus: 'ambient' });
    audio.stopAll();
    await Promise.resolve();
    expect(ctx.sources.every((s) => s.stopped)).toBe(true);
  });

  it('handle.stop() rejects ended', async () => {
    const { audio } = makeBus();
    const handle = audio.play(makeBuffer(), { bus: 'sfx' });
    handle.stop();
    await expect(handle.ended).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('handle.ended resolves when source naturally ends', async () => {
    const { audio, ctx } = makeBus();
    const handle = audio.play(makeBuffer(), { bus: 'sfx' });
    ctx.sources[0]!.finishNaturally();
    await expect(handle.ended).resolves.toBeUndefined();
  });
});

describe('createAudioBus — context lifecycle', () => {
  it('resume() resumes a suspended context', async () => {
    const ctx = new FakeAudioContext();
    ctx.state = 'suspended';
    const audio = createAudioBus({ audioContext: ctx as unknown as AudioContext });
    await audio.resume();
    expect(ctx.state).toBe('running');
  });

  it('destroy() closes the context and stops all sources', async () => {
    const { audio, ctx } = makeBus();
    audio.play(makeBuffer(), { bus: 'sfx' });
    await audio.destroy();
    expect(ctx.state).toBe('closed');
    expect(ctx.sources[0]!.stopped).toBe(true);
  });
});

describe('createAudioBus — decode', () => {
  it('decodes ArrayBuffer via context.decodeAudioData', async () => {
    const ctx = new FakeAudioContext();
    const audio: AudioBusManager = createAudioBus({
      audioContext: ctx as unknown as AudioContext,
    });
    const buffer = await audio.decode(new ArrayBuffer(64));
    expect(buffer).toBeDefined();
  });
});
