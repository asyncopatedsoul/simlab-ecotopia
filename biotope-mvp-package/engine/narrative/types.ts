/**
 * Ink narrative integration (bd-rntm.5).
 *
 * Wraps inkjs's Story behind a tighter API with:
 *   - line-level subscription (fires on every Continue advance)
 *   - prefixed tag subscription (`onTag('VO:', ...)` is how the audio bus
 *     gets notified to trigger a VO clip)
 *   - external-function binding
 *
 * Compilation strategy per docs/biotope-mvp-planning.md §4.4: .ink files are
 * authored alongside the manifest, compiled to .json at scenario build time,
 * and the runtime loads the JSON. compileInk() exposes the same compiler so
 * tests and tooling don't need a separate inklecate install.
 */

export type InkLine = {
  text: string;
  tags: ReadonlyArray<string>;
};

export type InkChoice = {
  index: number;
  text: string;
};

export type InkExternalFn = (...args: unknown[]) => unknown;

export interface InkRuntime {
  /** Advance one line. Returns null when the story can't continue. */
  continue(): InkLine | null;
  /** Continue until the next choice or end. */
  continueMaximally(): InkLine[];
  canContinue(): boolean;
  /** Choices available right now. Empty if not at a choice point. */
  choices(): InkChoice[];
  /** Pick a choice. The next continue() will follow that branch. */
  choose(index: number): void;
  /** Story has reached an -> END or DONE with no more content. */
  isEnded(): boolean;
  /** Fired once per produced line, in order. Returns an unsubscribe. */
  onLine(listener: (line: InkLine) => void): () => void;
  /**
   * Fired for each tag whose text starts with `prefix`. The handler receives
   * the suffix after the prefix (with leading whitespace trimmed). Multiple
   * handlers can be registered per prefix.
   */
  onTag(prefix: string, handler: (rest: string, fullTag: string) => void): () => void;
  /** Bind a JS function callable from the Ink script via EXTERNAL. */
  bindExternal(name: string, fn: InkExternalFn): void;
  /** Move the story flow to a knot/stitch path. */
  goTo(path: string): void;
  /**
   * Save the runtime state. Returns a JSON-serializable object that
   * `restore()` accepts. Composes with the loop runtime persistence.
   */
  save(): string;
  /** Restore from a previous save() result. */
  restore(state: string): void;
}

export type CreateInkRuntimeOptions = {
  /** Compiled Ink JSON. Pass either the JSON string or the parsed object. */
  storyJson: string | object;
  /** External functions, bound before the first Continue. */
  external?: Record<string, InkExternalFn>;
};
