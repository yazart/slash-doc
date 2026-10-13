import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { compileDocumentation } from '../src/compiler/documentation-compiler';
import { encodeStoredPage } from '../src/shared/page-storage-format';
import { renderRepositoryLink } from '../src/extension/site-repository';

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('standalone documentation compiler', () => {
  it('builds a searchable static site without VS Code', async () => {
    const projectRoot = await createProject();
    await initializeGitProject(projectRoot);
    const outputRoot = join(projectRoot, 'public-docs');
    const result = await compileDocumentation({
      projectRoot,
      outputRoot,
      projectName: 'Test docs',
      repositoryUrl: 'https://gitlab.example/group/project.git',
    });
    const index = await readFile(result.indexPath, 'utf8');
    const firstPage = await readFile(join(outputRoot, 'pages', 'start.html'), 'utf8');

    expect(result).toMatchObject({ outputRoot, pageCount: 2 });
    expect(index).toContain('<title>Test docs</title>');
    expect(index).toContain('"pageId":"start"');
    expect(index).toContain('Second page');
    expect(index).toContain('class="sidebar-resizer"');
    expect(index).toContain("'#page/' + encodeURIComponent(pageId)");
    expect(index).toContain('slash-doc-sidebar-width');
    expect(index).toContain('slash-doc-theme');
    expect(index).toContain('class="theme-toggle"');
    expect(index).toContain('data-page-id="start"');
    const hostScript = /<script>([\s\S]*?)<\/script>/.exec(index)?.[1] ?? '';
    expect(() => new Function(hostScript)).not.toThrow();
    expect(index).toMatch(/\.sidebar\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(index).toMatch(/\.navigation\s*\{[^}]*overflow-y:\s*auto;[^}]*scrollbar-gutter:\s*stable;/s);
    expect(firstPage).toContain('href="details.html#section"');
    expect(firstPage).toContain('target="_blank" rel="noopener noreferrer"');
    expect(firstPage).toContain('slash-doc-page-id');
    expect(firstPage).toContain("type:'slash-doc-page'");
    expect(firstPage).toContain("data-slash-doc-theme='dark'");
    const revision = firstPage.match(/Изменено: <time datetime="([^"]+)">([\s\S]*?<\/p>)/);
    expect(Date.parse(revision?.[1] ?? '')).toBe(Date.parse('2024-05-06T12:00:00Z'));
    expect(revision?.[2]).toBe(
      '06/05/2024</time> <span class="slash-doc-page-revision-user">Test User</span> <a href="https://gitlab.example/group/project/-/edit/main/.slash-doc/docs/pages/start/content.yaml" target="_blank" rel="noopener noreferrer">Редактировать</a></p>',
    );
    expect(firstPage).toContain('<span class="slash-doc-page-revision-user">Test User</span>');
    expect(firstPage).toContain('Создал: <span>Test User</span>');
    expect(index).toContain('class="documentation-logo" href="/"');
    expect(index).toContain('<link rel="icon" href="data:image/svg+xml,');
    expect(firstPage).toContain('<link rel="icon" href="data:image/svg+xml,');
    expect(index).toContain('aria-controls="documentation-sidebar"');
    expect(firstPage).toContain(
      'href="https://gitlab.example/group/project/-/edit/main/.slash-doc/docs/pages/start/content.yaml"',
    );
    expect(firstPage.indexOf('<p class="slash-doc-page-revision">')).toBeGreaterThan(
      firstPage.indexOf('<h1>Start</h1>'),
    );
    expect(firstPage).toContain('data-slash-doc-copy-control');
    expect(firstPage).toContain('Скопировать HTML');
    expect(firstPage).toContain('navigator.clipboard?.writeText');
    expect(firstPage).toContain("document.execCommand('copy')");
    const copyScript = /<script data-slash-doc-copy-script>([\s\S]*?)<\/script>/.exec(firstPage)?.[1] ?? '';
    expect(() => new Function(copyScript)).not.toThrow();
  });

  it('uses the default output directory and creates a page when content is missing', async () => {
    const projectRoot = await createProject(false);
    const result = await compileDocumentation({ projectRoot });
    const missingPage = await readFile(join(result.outputRoot, 'pages', 'details.html'), 'utf8');

    expect(result.outputRoot).toBe(join(projectRoot, 'slash-doc-site'));
    expect(missingPage).toContain('<h2>Details</h2>');
  });

  it('adds the optional repository link below the sidebar title when a URL is configured', async () => {
    const projectRoot = await createProject();
    const settingsFile = join(projectRoot, '.slash-doc', 'sdsettings.json');
    const repositoryUrl = 'https://gitlab.example/group/project?view=docs&tab=files';
    await writeFile(settingsFile, JSON.stringify({ exportOptions: { repositoryUrl } }));
    let result = await compileDocumentation({ projectRoot });
    expect(await readFile(result.indexPath, 'utf8')).not.toContain('<a class="documentation-repository"');
    await writeFile(settingsFile, JSON.stringify({ exportOptions: { showRepositoryLink: true, repositoryUrl } }));
    result = await compileDocumentation({ projectRoot });
    expect(await readFile(result.indexPath, 'utf8')).toContain(
      '</a><a class="documentation-repository" href="https://gitlab.example/group/project?view=docs&amp;tab=files" target="_blank" rel="noopener noreferrer">Репозиторий</a>',
    );
    result = await compileDocumentation({ projectRoot, repositoryUrl: 'https://example.com/override' });
    expect(await readFile(result.indexPath, 'utf8')).toContain(
      'class="documentation-repository" href="https://example.com/override"',
    );
    result = await compileDocumentation({ projectRoot, repositoryUrl: '' });
    expect(await readFile(result.indexPath, 'utf8')).not.toContain('<a class="documentation-repository"');
    for (const repositoryUrl of ['javascript:alert(1)', 'https://'])
      expect(renderRepositoryLink({ showRepositoryLink: true, repositoryUrl })).toBe('');
  });

  it('embeds a custom favicon in the host and documents even with extracted files', async () => {
    const projectRoot = await createProject();
    const favicon = 'data:image/png;base64,aGVsbG8=';
    await writeFile(
      join(projectRoot, '.slash-doc', 'sdsettings.json'),
      JSON.stringify({ exportOptions: { favicon, separateFiles: true } }),
    );
    const result = await compileDocumentation({ projectRoot });
    for (const path of [result.indexPath, join(result.outputRoot, 'pages', 'start.html')]) {
      expect(await readFile(path, 'utf8')).toContain(`<link rel="icon" href="${favicon}">`);
    }
  });

  it('compiles optional copy and ordered document navigation controls', async () => {
    const projectRoot = await createProject();
    const settingsFile = join(projectRoot, '.slash-doc', 'sdsettings.json');
    await writeFile(
      settingsFile,
      JSON.stringify({ exportOptions: { showCopyHtmlButton: false, showPageNavigation: true, separateFiles: true } }),
    );
    const result = await compileDocumentation({ projectRoot });
    const start = await readFile(join(result.outputRoot, 'pages', 'start.html'), 'utf8');
    const last = await readFile(join(result.outputRoot, 'pages', 'details.html'), 'utf8');
    expect(start).toContain('href="details.html" rel="next"');
    expect(start).not.toContain('rel="prev"');
    expect(last).toContain('href="start.html" rel="prev"');
    expect(last).not.toContain('rel="next"');
    expect(start).not.toContain('<button class="slash-doc-copy-html"');
    expect(start).not.toContain('<script data-slash-doc-copy-script>');
    expect(start).not.toMatch(/<body\b[^>]*data-slash-doc-copy-enabled/);
    await writeFile(settingsFile, JSON.stringify({ exportOptions: { showPageNavigation: false } }));
    await compileDocumentation({ projectRoot });
    expect(await readFile(join(result.outputRoot, 'pages', 'start.html'), 'utf8')).not.toContain(
      '<nav class="slash-doc-page-navigation"',
    );
  });

  it('loads YAML page state with adjacent resources before legacy JSON', async () => {
    const projectRoot = await createProject();
    const pageRoot = join(projectRoot, '.slash-doc', 'docs', 'pages', 'start');
    const stored = encodeStoredPage({
      blocks: [
        { type: 'header', data: { text: 'YAML page', level: 1 } },
        { type: 'image', data: { file: { url: 'data:image/png;base64,aGVsbG8=' } } },
      ],
    });
    await writeFile(join(pageRoot, 'content.yaml'), stored.yaml);
    await Promise.all(stored.resources.map((resource) => writeFile(join(pageRoot, resource.fileName), resource.data)));

    const result = await compileDocumentation({ projectRoot });
    const page = await readFile(join(result.outputRoot, 'pages', 'start.html'), 'utf8');

    expect(page).toContain('<h1>YAML page</h1>');
    expect(page).toContain('data:image/png;base64,aGVsbG8=');
    expect(page).not.toContain('<h1>Start</h1>');
  });

  it('builds a hierarchical Markdown tree and extracts page images', async () => {
    const projectRoot = await createProject();
    const outputRoot = join(projectRoot, 'markdown-docs');
    const docsRoot = join(projectRoot, '.slash-doc', 'docs');
    await writeFile(
      join(docsRoot, 'menu.json'),
      JSON.stringify({
        items: [
          {
            id: 'start',
            title: 'Start page',
            file: 'start/content.json',
            children: [{ id: 'details', title: 'Child page', file: 'details/content.json', children: [] }],
          },
        ],
      }),
    );
    await writeFile(
      join(projectRoot, '.slash-doc', 'sdsettings.json'),
      JSON.stringify({ exportOptions: { separateFiles: true } }),
    );
    const startContentPath = join(docsRoot, 'pages', 'start', 'content.json');
    const startContent = JSON.parse(await readFile(startContentPath, 'utf8')) as { blocks: unknown[] };
    startContent.blocks.push({
      type: 'image',
      data: { file: { url: 'data:image/png;base64,aGVsbG8=' }, caption: 'Picture' },
    });
    await writeFile(startContentPath, JSON.stringify(startContent));

    const result = await compileDocumentation({ projectRoot, outputRoot, format: 'md' });
    const contents = await readFile(join(outputRoot, 'README.md'), 'utf8');
    const parent = await readFile(join(outputRoot, 'Start page', 'Start page.md'), 'utf8');
    const child = await readFile(join(outputRoot, 'Start page', 'Child page', 'Child page.md'), 'utf8');
    const image = await readFile(join(outputRoot, 'Start page', 'image-1.png'));

    expect(result.indexPath).toBe(join(outputRoot, 'README.md'));
    expect(contents).toContain('- [Start page](Start%20page/Start%20page.md)');
    expect(contents).toContain('  - [Child page](Start%20page/Child%20page/Child%20page.md)');
    expect(parent).toContain('[inside](Child%20page/Child%20page.md#section)');
    expect(parent).toContain('![Picture](image-1.png)');
    expect(child).toContain('## Details');
    expect(image.toString('utf8')).toBe('hello');
  });

  it('uses the image extraction setting for HTML site compilation', async () => {
    const projectRoot = await createProject();
    const outputRoot = join(projectRoot, 'html-docs');
    await writeFile(
      join(projectRoot, '.slash-doc', 'sdsettings.json'),
      JSON.stringify({ exportOptions: { extractImages: true } }),
    );
    const contentPath = join(projectRoot, '.slash-doc', 'docs', 'pages', 'start', 'content.json');
    const content = JSON.parse(await readFile(contentPath, 'utf8')) as { blocks: unknown[] };
    content.blocks.push({ type: 'image', data: { file: { url: 'data:image/png;base64,aGVsbG8=' } } });
    await writeFile(contentPath, JSON.stringify(content));

    await compileDocumentation({ projectRoot, outputRoot });
    const page = await readFile(join(outputRoot, 'pages', 'start.html'), 'utf8');
    const image = await readFile(join(outputRoot, 'pages', 'start-image-1.png'));

    expect(page).toContain('src="start-image-1.png"');
    expect(page).not.toContain('data:image/png;base64');
    expect(page).toContain('data-slash-doc-copy-images');
    expect(page).toContain('"type":"image/png","data":"aGVsbG8="');
    expect(image.toString('utf8')).toBe('hello');
  });

  it('uses the configured default branch instead of a commit hash for detached HEAD', async () => {
    const projectRoot = await createProject();
    await initializeGitProject(projectRoot);
    await execFileAsync('git', ['checkout', '--detach', 'HEAD'], { cwd: projectRoot });
    await writeFile(
      join(projectRoot, '.slash-doc', 'sdsettings.json'),
      JSON.stringify({
        exportOptions: {
          repositoryUrl: 'https://gitlab.example/group/project',
          defaultBranch: 'docs-main',
        },
      }),
    );
    const commitHash = (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot })).stdout.trim();

    const result = await compileDocumentation({ projectRoot });
    const page = await readFile(join(result.outputRoot, 'pages', 'start.html'), 'utf8');

    expect(page).toContain(
      'href="https://gitlab.example/group/project/-/edit/docs-main/.slash-doc/docs/pages/start/content.yaml"',
    );
    expect(page).not.toContain(`/-/edit/${commitHash}/`);
  });
});

async function createProject(includeSecondPage = true): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'slash-doc-compiler-'));
  temporaryDirectories.push(projectRoot);
  const docsRoot = join(projectRoot, '.slash-doc', 'docs');
  await mkdir(join(docsRoot, 'pages', 'start'), { recursive: true });
  await mkdir(join(docsRoot, 'pages', 'details'), { recursive: true });
  await writeFile(
    join(docsRoot, 'menu.json'),
    JSON.stringify({
      items: [
        { id: 'start', title: 'Start', file: 'start/content.json', children: [] },
        { id: 'details', title: 'Details', file: 'details/content.json', children: [] },
      ],
    }),
  );
  await writeFile(
    join(docsRoot, 'pages', 'start', 'content.json'),
    JSON.stringify({
      blocks: [
        { type: 'header', data: { text: 'Start', level: 1 } },
        {
          type: 'paragraph',
          data: {
            text: 'Second page <a href="slash-doc://page/details#section">inside</a> <a href="https://example.com">outside</a>',
          },
        },
      ],
    }),
  );
  if (includeSecondPage) {
    await writeFile(
      join(docsRoot, 'pages', 'details', 'content.json'),
      JSON.stringify({ blocks: [{ type: 'header', data: { text: 'Details', level: 2 } }] }),
    );
  }
  return projectRoot;
}

async function initializeGitProject(projectRoot: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: projectRoot });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
  await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
  await execFileAsync('git', ['commit', '-m', 'Initial documentation'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2024-05-06T12:00:00+00:00',
      GIT_COMMITTER_DATE: '2024-05-06T12:00:00+00:00',
    },
  });
}
