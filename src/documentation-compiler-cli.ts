#!/usr/bin/env node
import { resolve } from 'node:path';
import { compileDocumentation } from './compiler/documentation-compiler';

type CliOptions = {
  projectRoot: string;
  outputRoot?: string;
  addonsRoot?: string;
  projectName?: string;
  help: boolean;
};

export function parseCompilerArguments(args: string[], currentDirectory = process.cwd()): CliOptions {
  const options: CliOptions = { projectRoot: currentDirectory, help: false };
  let projectWasSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--output' || argument === '-o') {
      options.outputRoot = readOptionValue(args, ++index, argument);
    } else if (argument === '--addons') {
      options.addonsRoot = readOptionValue(args, ++index, argument);
    } else if (argument === '--name') {
      options.projectName = readOptionValue(args, ++index, argument);
    } else if (argument.startsWith('-')) {
      throw new Error(`Неизвестный параметр: ${argument}`);
    } else if (!projectWasSet) {
      options.projectRoot = argument;
      projectWasSet = true;
    } else {
      throw new Error(`Лишний аргумент: ${argument}`);
    }
  }

  options.projectRoot = resolve(currentDirectory, options.projectRoot);
  if (options.outputRoot) options.outputRoot = resolve(currentDirectory, options.outputRoot);
  if (options.addonsRoot) options.addonsRoot = resolve(currentDirectory, options.addonsRoot);
  return options;
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) throw new Error(`Для ${option} требуется значение.`);
  return value;
}

export function getCompilerHelp(): string {
  return `Slash Doc — автономная сборка HTML-документации

Использование:
  slash-doc-compile [проект] [параметры]

Параметры:
  -o, --output <папка>  Папка результата (по умолчанию <проект>/slash-doc-site)
      --addons <папка>  Каталог модулей пользовательских Editor.js-виджетов
      --name <название> Название документации в сайдбаре
  -h, --help            Показать справку
`;
}

async function main(): Promise<void> {
  const options = parseCompilerArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(getCompilerHelp());
    return;
  }
  const result = await compileDocumentation(options);
  process.stdout.write(`Собрано страниц: ${result.pageCount}\n${result.indexPath}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Не удалось собрать документацию: ${message}\n`);
  process.exitCode = 1;
});
