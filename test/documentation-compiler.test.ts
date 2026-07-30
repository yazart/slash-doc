import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { compileDocumentation } from '../src/compiler/documentation-compiler';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('standalone documentation compiler', () => {
  it('builds a searchable static site without VS Code', async () => {
    const projectRoot = await createProject();
    const outputRoot = join(projectRoot, 'public-docs');
    const result = await compileDocumentation({ projectRoot, outputRoot, projectName: 'Test docs' });
    const index = await readFile(result.indexPath, 'utf8');
    const firstPage = await readFile(join(outputRoot, 'pages', 'start.html'), 'utf8');

    expect(result).toMatchObject({ outputRoot, pageCount: 2 });
    expect(index).toContain('<title>Test docs</title>');
    expect(index).toContain('"pageId":"start"');
    expect(index).toContain('Second page');
    expect(firstPage).toContain('href="details.html#section"');
    expect(firstPage).toContain('target="_blank" rel="noopener noreferrer"');
    expect(firstPage).toContain('slash-doc-page-id');
  });

  it('uses the default output directory and creates a page when content is missing', async () => {
    const projectRoot = await createProject(false);
    const result = await compileDocumentation({ projectRoot });
    const missingPage = await readFile(join(result.outputRoot, 'pages', 'details.html'), 'utf8');

    expect(result.outputRoot).toBe(join(projectRoot, 'slash-doc-site'));
    expect(missingPage).toContain('<h2>Details</h2>');
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
