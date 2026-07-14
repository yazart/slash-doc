import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { getPagesRootUri } from './filesystem';

export type ProcessorFileInfo = {
  name: string;
  size: number;
  modified: number;
};

export type UploadedProcessorFile = {
  name: string;
  dataUrl: string;
};

export async function uploadProcessorFiles(
  workspaceRoot: vscode.Uri,
  pageId: string,
  files: UploadedProcessorFile[]
): Promise<{ files: ProcessorFileInfo[]; uploaded: ProcessorFileInfo[] }> {
  const directory = getProcessorDirectory(workspaceRoot, pageId);
  await mkdir(directory, { recursive: true });
  const uploadedNames: string[] = [];

  for (const file of files) {
    const name = sanitizeUploadName(file.name);
    uploadedNames.push(name);
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(file.dataUrl);
    if (!match) {
      throw new Error(`Некорректные данные файла: ${name}`);
    }
    const content = match[2]
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8');
    await writeFile(resolve(directory, name), content);
  }

  const allFiles = await listProcessorFiles(directory);
  return {
    files: allFiles,
    uploaded: allFiles.filter((file) => uploadedNames.includes(file.name))
  };
}

export async function runPageProcessor(
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  pageId: string,
  script: string,
  inputFiles: string[]
): Promise<{ files: ProcessorFileInfo[]; results: ProcessorFileInfo[]; stdout: string; stderr: string }> {
  const directory = getProcessorDirectory(workspaceRoot, pageId);
  await mkdir(directory, { recursive: true });
  const before = new Map((await listProcessorFiles(directory)).map((file) => [file.name, file]));
  const scriptPath = resolve(directory, '.slash-doc-processor.cjs');
  await writeFile(scriptPath, script, 'utf8');
  const runnerPath = vscode.Uri.joinPath(extensionUri, 'dist', 'file-processor-runner.js').fsPath;
  const execution = await executeRunner(runnerPath, scriptPath, directory);
  const files = await listProcessorFiles(directory);
  const inputSet = new Set(inputFiles);
  const results = files.filter((file) => {
    const previous = before.get(file.name);
    return !inputSet.has(file.name) || !previous || previous.size !== file.size || previous.modified !== file.modified;
  });
  return { files, results, ...execution };
}

export async function downloadProcessorFile(
  workspaceRoot: vscode.Uri,
  pageId: string,
  fileName: string
): Promise<void> {
  const directory = getProcessorDirectory(workspaceRoot, pageId);
  const sourcePath = resolveSafeFile(directory, fileName);
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(resolve(workspaceRoot.fsPath, basename(fileName))),
    saveLabel: 'Скачать результат'
  });
  if (target) {
    await vscode.workspace.fs.copy(vscode.Uri.file(sourcePath), target, { overwrite: true });
  }
}

function getProcessorDirectory(workspaceRoot: vscode.Uri, pageId: string): string {
  return vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), pageId, 'files').fsPath;
}

function sanitizeUploadName(value: string): string {
  const name = basename(value).replaceAll(/[^\p{L}\p{N}._ -]/gu, '_').trim();
  if (!/\.(csv|json)$/i.test(name)) {
    throw new Error('Разрешены только CSV и JSON файлы.');
  }
  return name || `file-${Date.now()}.json`;
}

function resolveSafeFile(directory: string, fileName: string): string {
  const target = resolve(directory, fileName);
  const root = resolve(directory);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error('Недопустимый путь к файлу.');
  }
  return target;
}

async function listProcessorFiles(directory: string): Promise<ProcessorFileInfo[]> {
  const result: ProcessorFileInfo[] = [];
  await walk(directory, directory, result);
  return result.sort((left, right) => left.name.localeCompare(right.name));
}

async function walk(root: string, directory: string, result: ProcessorFileInfo[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.slash-doc-processor.cjs') {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(root, path, result);
    } else if (entry.isFile()) {
      const details = await stat(path);
      result.push({ name: relative(root, path).split(sep).join('/'), size: details.size, modified: details.mtimeMs });
    }
  }
}

function executeRunner(
  runnerPath: string,
  scriptPath: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [runnerPath, scriptPath], {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const append = (current: string, chunk: Buffer): string => `${current}${chunk.toString('utf8')}`.slice(-100_000);
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Сценарий остановлен: превышен лимит выполнения 30 секунд.'));
    }, 30_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(stderr.trim() || `Сценарий завершился с кодом ${code ?? 'unknown'}.`));
      }
    });
  });
}
