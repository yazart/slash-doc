import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import * as csv from 'csv';
import * as csvSync from 'csv/sync';

async function main(): Promise<void> {
  const scriptPath = resolve(process.argv[2] ?? '.slash-doc-processor.cjs');
  const source = await readFile(scriptPath, 'utf8');
  const nativeRequire = createRequire(scriptPath);
  const localRequire = (request: string): unknown => {
    if (request === 'csv') {
      return csv;
    }
    if (request === 'csv/sync') {
      return csvSync;
    }
    return nativeRequire(request);
  };
  const module = { exports: {} as unknown };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;
  const execute = new AsyncFunction('require', 'module', 'exports', '__dirname', '__filename', 'csv', source);
  await execute(localRequire, module, module.exports, dirname(scriptPath), scriptPath, csv);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
