import { Compiler } from 'inkjs/compiler/Compiler';

export type CompileResult = {
  /** Compiled story as a JSON string ready to feed createInkRuntime. */
  json: string;
  warnings: ReadonlyArray<string>;
};

export class InkCompileError extends Error {
  override readonly name = 'InkCompileError';
  constructor(
    message: string,
    public readonly errors: ReadonlyArray<string>,
    public readonly warnings: ReadonlyArray<string>,
  ) {
    super(message);
  }
}

/**
 * Compile .ink source to JSON. Used at scenario build time and in tests so
 * we don't need a separate inklecate install. Throws InkCompileError on
 * compile errors; warnings are returned alongside the JSON for the caller
 * to surface.
 */
export function compileInk(source: string): CompileResult {
  const compiler = new Compiler(source);
  let story;
  try {
    story = compiler.Compile();
  } catch (e) {
    const errors = compiler.errors.slice();
    const warnings = compiler.warnings.slice();
    if (errors.length === 0) errors.push(e instanceof Error ? e.message : String(e));
    throw new InkCompileError(
      `Ink compile failed: ${errors.length} error${errors.length === 1 ? '' : 's'}`,
      errors,
      warnings,
    );
  }
  const errors = compiler.errors.slice();
  const warnings = compiler.warnings.slice();
  if (errors.length > 0) {
    throw new InkCompileError(
      `Ink compile failed: ${errors.length} error${errors.length === 1 ? '' : 's'}`,
      errors,
      warnings,
    );
  }
  const json = story.ToJson() as string;
  return { json, warnings };
}
