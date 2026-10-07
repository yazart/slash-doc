import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type PageRevisionMetadata = {
  changedAt: string;
  user: string;
  editUrl?: string;
};

export async function readPageRevisionMetadata(
  projectRoot: string,
  pageFile: string,
  repositoryUrl = '',
): Promise<PageRevisionMetadata> {
  const gitRoot = await gitOptional(projectRoot, ['rev-parse', '--show-toplevel']);
  const revisionRoot = await canonicalPath(gitRoot || projectRoot);
  const revisionFile = await canonicalPath(pageFile);
  const revisionPath = toGitPath(revisionRoot, revisionFile);
  const dirty = gitRoot
    ? await gitOptional(gitRoot, ['status', '--porcelain', '--untracked-files=all', '--', revisionPath])
    : '';
  const committed =
    gitRoot && !dirty
      ? await gitOptional(gitRoot, ['log', '-1', '--follow', '--format=%aI%x1f%an', '--', revisionPath])
      : '';
  const [commitDate, commitUser] = committed.split('\x1f');
  const fallbackDate = await readFileDate(pageFile);
  const fallbackUser =
    (gitRoot ? await gitOptional(gitRoot, ['config', 'user.name']) : '') ||
    process.env.GIT_AUTHOR_NAME ||
    process.env.USER ||
    '—';
  const ref = gitRoot
    ? (await gitOptional(gitRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'])) ||
      (await gitOptional(gitRoot, ['rev-parse', 'HEAD']))
    : 'main';
  return {
    changedAt: commitDate || fallbackDate,
    user: commitUser || fallbackUser,
    editUrl: repositoryUrl ? createGitLabEditUrl(repositoryUrl, ref || 'main', revisionPath) : undefined,
  };
}

async function canonicalPath(value: string): Promise<string> {
  try {
    return await realpath(value);
  } catch {
    return resolve(value);
  }
}

export async function resolvePageRevisionFile(projectRoot: string, pageId: string): Promise<string> {
  const pageRoot = resolve(projectRoot, '.slash-doc', 'docs', 'pages', pageId);
  const yaml = resolve(pageRoot, 'content.yaml');
  if (await fileExists(yaml)) return yaml;
  const json = resolve(pageRoot, 'content.json');
  return (await fileExists(json)) ? json : yaml;
}

export function createGitLabEditUrl(repositoryUrl: string, ref: string, filePath: string): string {
  const repository = normalizeRepositoryUrl(repositoryUrl);
  const encodedRef = encodeURIComponent(ref.trim() || 'main');
  const encodedPath = filePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${repository}/-/edit/${encodedRef}/${encodedPath}`;
}

function normalizeRepositoryUrl(value: string): string {
  const trimmed = value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  const ssh = /^git@([^:]+):(.+)$/.exec(trimmed);
  const candidate = ssh ? `https://${ssh[1]}/${ssh[2]}` : trimmed;
  const repository = candidate.split('/-/')[0].replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(repository);
  } catch {
    throw new Error(`Некорректный URL GitLab-репозитория: ${value}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`URL GitLab-репозитория должен использовать HTTP(S): ${value}`);
  }
  return parsed.href.replace(/\/+$/, '');
}

async function readFileDate(filePath: string): Promise<string> {
  try {
    return (await stat(filePath)).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function gitOptional(cwd: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return String(result.stdout).trim();
  } catch {
    return '';
  }
}

function toGitPath(root: string, filePath: string): string {
  const value = relative(root, filePath).split(sep).join('/');
  return value === '..' || value.startsWith('../') ? relative(resolve(filePath, '..'), filePath) : value;
}
