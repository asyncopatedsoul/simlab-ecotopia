import { describe, expect, it, vi } from 'vitest';
import { compileInk, InkCompileError } from './compileInk';
import { createInkRuntime } from './inkRuntime';

const TWO_BRANCH_SCRIPT = `
EXTERNAL get_player_name()

-> brief

=== brief ===
Hello {get_player_name()}. Welcome to the window. # VO: greeting
What would you like to look at?
+ [Watch the bird] -> bird
+ [Watch the squirrel] -> squirrel

=== bird ===
A robin hops on the lawn. # VO: bird_robin
The orange chest gives it away.
-> END

=== squirrel ===
A grey squirrel scampers up the oak. # VO: squirrel_oak
-> END
`.trim();

describe('compileInk', () => {
  it('compiles valid Ink to JSON', () => {
    const result = compileInk(TWO_BRANCH_SCRIPT);
    expect(typeof result.json).toBe('string');
    expect(result.json.length).toBeGreaterThan(0);
    expect(JSON.parse(result.json)).toBeTypeOf('object');
  });

  it('throws InkCompileError on bad syntax', () => {
    expect(() => compileInk('=== knot_with_unclosed_choice\n+ [unterminated')).toThrow(
      InkCompileError,
    );
  });
});

describe('createInkRuntime — two-branch acceptance scenario', () => {
  function makeRuntime() {
    const { json } = compileInk(TWO_BRANCH_SCRIPT);
    const getPlayerName = vi.fn().mockReturnValue('Mike');
    const runtime = createInkRuntime({
      storyJson: json,
      external: { get_player_name: getPlayerName },
    });
    return { runtime, getPlayerName };
  }

  it('runs the brief with VO trigger, external call, and surfaces choices', () => {
    const { runtime, getPlayerName } = makeRuntime();

    const voFired: string[] = [];
    runtime.onTag('VO:', (id) => voFired.push(id));

    // Continue until we hit the choice point.
    const lines = runtime.continueMaximally();
    expect(lines.length).toBeGreaterThan(0);
    const greetingLine = lines[0]!;
    expect(greetingLine.text).toContain('Hello Mike.');
    expect(getPlayerName).toHaveBeenCalledOnce();

    // VO tag handler fired with the greeting id.
    expect(voFired).toContain('greeting');

    // Two choices available.
    const choices = runtime.choices();
    expect(choices.map((c) => c.text)).toEqual(['Watch the bird', 'Watch the squirrel']);
  });

  it('takes the bird branch end-to-end with branch-specific VO', () => {
    const { runtime } = makeRuntime();
    const voFired: string[] = [];
    runtime.onTag('VO:', (id) => voFired.push(id));

    runtime.continueMaximally();
    runtime.choose(0);
    const branchLines = runtime.continueMaximally();
    const branchText = branchLines.map((l) => l.text).join('');
    expect(branchText).toContain('robin');
    expect(branchText).toContain('orange chest');
    expect(voFired).toContain('bird_robin');
    expect(voFired).not.toContain('squirrel_oak');
    expect(runtime.isEnded()).toBe(true);
  });

  it('takes the squirrel branch end-to-end', () => {
    const { runtime } = makeRuntime();
    const voFired: string[] = [];
    runtime.onTag('VO:', (id) => voFired.push(id));

    runtime.continueMaximally();
    runtime.choose(1);
    const branchLines = runtime.continueMaximally();
    expect(branchLines.map((l) => l.text).join('')).toContain('squirrel');
    expect(voFired).toContain('squirrel_oak');
    expect(voFired).not.toContain('bird_robin');
    expect(runtime.isEnded()).toBe(true);
  });
});

describe('createInkRuntime — line and tag subscription', () => {
  it('onLine receives every produced line in order', () => {
    const { json } = compileInk(`
A.
B.
C.
-> END
`.trim());
    const runtime = createInkRuntime({ storyJson: json });
    const lines: string[] = [];
    runtime.onLine((line) => lines.push(line.text.trim()));
    runtime.continueMaximally();
    expect(lines).toEqual(['A.', 'B.', 'C.']);
  });

  it('onTag dispatches by prefix and trims leading whitespace from the rest', () => {
    const { json } = compileInk(`
First. # VO: brief_intro #LIGHTING: morning
Second. #LIGHTING: midday
-> END
`.trim());
    const runtime = createInkRuntime({ storyJson: json });
    const vo: string[] = [];
    const lighting: string[] = [];
    runtime.onTag('VO:', (rest) => vo.push(rest));
    runtime.onTag('LIGHTING:', (rest) => lighting.push(rest));
    runtime.continueMaximally();
    expect(vo).toEqual(['brief_intro']);
    expect(lighting).toEqual(['morning', 'midday']);
  });

  it('onTag/onLine handlers can be unsubscribed', () => {
    const { json } = compileInk(`A.\nB.\n-> END`);
    const runtime = createInkRuntime({ storyJson: json });
    const seen: string[] = [];
    const off = runtime.onLine((line) => seen.push(line.text.trim()));
    runtime.continue();
    off();
    runtime.continueMaximally();
    expect(seen).toEqual(['A.']);
  });

  it('handler exceptions do not break flow', () => {
    const { json } = compileInk(`A.\nB.\n-> END`);
    const runtime = createInkRuntime({ storyJson: json });
    runtime.onLine(() => {
      throw new Error('boom');
    });
    const lines = runtime.continueMaximally();
    expect(lines).toHaveLength(2);
  });
});

describe('createInkRuntime — external functions', () => {
  it('passes arguments and uses the return value', () => {
    const { json } = compileInk(`
EXTERNAL repeat(s, n)

{repeat("ha", 3)}
-> END
`.trim());
    const repeat = vi.fn((s: string, n: number) => s.repeat(n));
    const runtime = createInkRuntime({
      storyJson: json,
      external: { repeat: repeat as never },
    });
    const lines = runtime.continueMaximally();
    expect(lines[0]!.text.trim()).toBe('hahaha');
    expect(repeat).toHaveBeenCalledWith('ha', 3);
  });

  it('bindExternal works after construction', () => {
    const { json } = compileInk(`
EXTERNAL today()

It is {today()}.
-> END
`.trim());
    const runtime = createInkRuntime({ storyJson: json });
    runtime.bindExternal('today', () => 'Tuesday');
    const lines = runtime.continueMaximally();
    expect(lines[0]!.text).toContain('It is Tuesday.');
  });
});

describe('createInkRuntime — save / restore', () => {
  it('round-trips state through save/restore (resume mid-story)', () => {
    const { json } = compileInk(`
-> brief

=== brief ===
Line one. # VO: a
Line two. # VO: b
* [continue] -> mid

=== mid ===
Line three. # VO: c
-> END
`.trim());
    const r1 = createInkRuntime({ storyJson: json });
    r1.continueMaximally();
    expect(r1.choices()).toHaveLength(1);
    const saved = r1.save();

    const r2 = createInkRuntime({ storyJson: json });
    r2.restore(saved);
    expect(r2.choices().map((c) => c.text)).toEqual(['continue']);
    r2.choose(0);
    const after = r2.continueMaximally();
    expect(after.map((l) => l.text).join('')).toContain('Line three');
    expect(r2.isEnded()).toBe(true);
  });
});

describe('createInkRuntime — VO + audio integration shape', () => {
  it('integrates with an audio bus by wiring onTag("VO:") to a play handler', () => {
    const { json } = compileInk(`
Hello. # VO: greeting
-> END
`.trim());
    const runtime = createInkRuntime({ storyJson: json });

    // Stand-in for the AudioBus integration. In production this is:
    //   runtime.onTag('VO:', (id) => audioBus.play(buffers[id], { bus: 'voice' }));
    const audioBusPlay = vi.fn();
    runtime.onTag('VO:', (id) => audioBusPlay(id));
    runtime.continueMaximally();
    expect(audioBusPlay).toHaveBeenCalledWith('greeting');
  });
});
