#!/usr/bin/env node
import { resolve } from 'node:path';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createSlashDocMcpServer } from './mcp/server';
import { SlashDocRepository } from './mcp/repository';

export type McpCliOptions = { projectRoot: string; help: boolean };

export function parseMcpArguments(args: string[], currentDirectory = process.cwd()): McpCliOptions {
  let projectRoot = process.env.SLASH_DOC_PROJECT_ROOT || currentDirectory;
  let projectWasSet = false;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') help = true;
    else if (argument === '--project' || argument === '-p') projectRoot = readValue(args, ++index, argument);
    else if (argument.startsWith('-')) throw new Error(`Неизвестный параметр: ${argument}`);
    else if (!projectWasSet) {
      projectRoot = argument;
      projectWasSet = true;
    } else throw new Error(`Лишний аргумент: ${argument}`);
  }
  return { projectRoot: resolve(currentDirectory, projectRoot), help };
}

export function getMcpHelp(): string {
  return `Slash Doc MCP server

Использование:
  slash-doc-mcp [проект]
  slash-doc-mcp --project /path/to/project

Переменная окружения:
  SLASH_DOC_PROJECT_ROOT=/path/to/project

Сервер использует stdio. Не выводите служебные сообщения в stdout процесса.
`;
}

function readValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) throw new Error(`Для ${option} требуется значение.`);
  return value;
}

function main(): void {
  const options = parseMcpArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(getMcpHelp());
    return;
  }
  const repository = new SlashDocRepository(options.projectRoot);
  const transport = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 50 * 1024 * 1024 });
  serveStdio(() => createSlashDocMcpServer(repository), {
    transport,
    onerror: (error) => process.stderr.write(`Slash Doc MCP: ${error.message}\n`),
  });
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `Не удалось запустить Slash Doc MCP: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
