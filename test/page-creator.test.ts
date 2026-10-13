import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { readPageRevisionMetadata } from '../src/shared/page-revision';

const execFileAsync = promisify(execFile);

describe('page creator metadata', () => {
  it('distinguishes the creator from subsequent authors and follows file renames', async () => {
    const root = await mkdtemp(join(tmpdir(), 'slash-doc-creator-'));
    const git = (...args: string[]) => execFileAsync('git', args, { cwd: root });
    try {
      await git('init', '-b', 'main');
      await git('config', 'user.name', 'Original Creator');
      await git('config', 'user.email', 'creator@example.com');
      const file = join(root, 'content.yaml');
      await writeFile(file, 'First line\nSecond line\nThird line\nFourth line\n');
      await git('add', '.');
      await git('commit', '-m', 'Create page');
      await git('config', 'user.name', 'Later Editor');
      await writeFile(file, 'Updated line\nSecond line\nThird line\nFourth line\n');
      await git('add', '.');
      await git('commit', '-m', 'Edit page');
      expect(await readPageRevisionMetadata(root, file)).toMatchObject({
        creator: 'Original Creator',
        user: 'Later Editor',
      });
      const renamed = join(root, 'renamed.yaml');
      await rename(file, renamed);
      await git('add', '-A');
      await git('commit', '-m', 'Rename page');
      expect(await readPageRevisionMetadata(root, renamed)).toMatchObject({
        creator: 'Original Creator',
        user: 'Later Editor',
      });
      await writeFile(renamed, 'Uncommitted changes');
      expect(await readPageRevisionMetadata(root, renamed)).toMatchObject({
        creator: 'Original Creator',
        user: 'Later Editor',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
