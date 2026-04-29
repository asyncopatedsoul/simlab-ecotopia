/**
 * `biotope-validate <scenario-folder>` — bd-auth.2 CLI entry.
 *
 * Run via: `npm run scenario:validate -- path/to/scenario`
 *
 * Exit codes: 0 ok, 1 errors found, 2 invocation error.
 */
import { resolve } from 'node:path';
import { validateScenario } from '../engine/validate/index';

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write('Usage: biotope-validate <scenario-folder>\n');
    process.exit(2);
  }
  const folder = resolve(args[0]!);
  const result = validateScenario(folder);

  let errorCount = 0;
  let warningCount = 0;
  for (const issue of result.issues) {
    if (issue.severity === 'error') errorCount++;
    else warningCount++;
    const prefix = issue.severity === 'error' ? 'error' : 'warn ';
    const where = issue.path ? ` [${issue.path}]` : '';
    process.stderr.write(`${prefix} ${issue.code}${where}: ${issue.message}\n`);
  }

  if (result.ok) {
    process.stdout.write(
      `✓ ${folder} validated (${warningCount} warning${warningCount === 1 ? '' : 's'})\n`,
    );
    process.exit(0);
  } else {
    process.stderr.write(
      `\n✗ ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}\n`,
    );
    process.exit(1);
  }
}

main();
