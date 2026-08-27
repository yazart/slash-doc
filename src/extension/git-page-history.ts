import { execFile } from 'node:child_process';
import { relative, sep } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { decodeStoredPage } from '../shared/page-storage-format';
import { removePageTime } from '../shared/page-content';
import { getLegacyPageContentUri, getPageContentUri, getPageRootUri } from './filesystem';

const execFileAsync = promisify(execFile);
const COMMIT_FORMAT = '%H%x1f%h%x1f%aI%x1f%an%x1f%s%x1e';

export type PageGitCommit = {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
};

export async function readPageGitHistory(workspaceRoot: vscode.Uri, pageId: string): Promise<PageGitCommit[]> {
  const gitRoot = await git(workspaceRoot.fsPath, ['rev-parse', '--show-toplevel']);
  const paths = [getPageContentUri(workspaceRoot, pageId), getLegacyPageContentUri(workspaceRoot, pageId)].map((uri) =>
    gitPath(gitRoot, uri.fsPath),
  );
  const histories = await Promise.all(paths.map((path) => gitLog(gitRoot, path)));
  const commits = new Map(histories.flat().map((commit) => [commit.hash, commit]));
  return [...commits.values()].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

export async function readPageGitVersion(workspaceRoot: vscode.Uri, pageId: string, commit: string): Promise<unknown> {
  if (!/^[0-9a-f]{7,64}$/i.test(commit)) throw new Error('Некорректный идентификатор коммита.');
  const gitRoot = await git(workspaceRoot.fsPath, ['rev-parse', '--show-toplevel']);
  const pageRoot = gitPath(gitRoot, getPageRootUri(workspaceRoot, pageId).fsPath);
  const yamlPath = `${pageRoot}/content.yaml`;
  const yaml = await gitShowOptional(gitRoot, commit, yamlPath);
  if (yaml !== undefined) {
    return removePageTime(
      await decodeStoredPage(yaml, async (fileName) =>
        gitBuffer(gitRoot, ['show', `${commit}:${pageRoot}/${fileName}`]),
      ),
    );
  }
  const json = await gitShowOptional(gitRoot, commit, `${pageRoot}/content.json`);
  if (json !== undefined) return removePageTime(JSON.parse(json));
  throw new Error('В выбранном коммите страница отсутствует.');
}

async function gitLog(gitRoot: string, path: string): Promise<PageGitCommit[]> {
  const output = await git(gitRoot, ['log', '--follow', '--diff-filter=AM', `--format=${COMMIT_FORMAT}`, '--', path]);
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .flatMap((record) => {
      const [hash, shortHash, date, author, ...subject] = record.split('\x1f');
      return hash && shortHash && date ? [{ hash, shortHash, date, author, subject: subject.join('\x1f') }] : [];
    });
}

async function gitShowOptional(gitRoot: string, commit: string, path: string): Promise<string | undefined> {
  try {
    return await git(gitRoot, ['show', `${commit}:${path}`]);
  } catch {
    return undefined;
  }
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return String(result.stdout).trimEnd();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Git: ${detail}`);
  }
}

async function gitBuffer(cwd: string, args: string[]): Promise<Buffer> {
  try {
    const result = await execFileAsync('git', ['-C', cwd, ...args], {
      encoding: 'buffer',
      maxBuffer: 50 * 1024 * 1024,
    });
    return Buffer.from(result.stdout);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Git: ${detail}`);
  }
}

function gitPath(gitRoot: string, filePath: string): string {
  const path = relative(gitRoot, filePath).split(sep).join('/');
  if (!path || path === '..' || path.startsWith('../')) throw new Error('Файл страницы находится вне Git-репозитория.');
  return path;
}
