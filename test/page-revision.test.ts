import { describe, expect, it } from 'vitest';
import { createGitLabEditUrl } from '../src/shared/page-revision';

describe('GitLab page edit links', () => {
  it('creates an edit URL and encodes branch and path segments', () => {
    expect(
      createGitLabEditUrl(
        'https://gitlab.example/group/project.git',
        'feature/docs',
        '.slash-doc/docs/pages/page 1/content.yaml',
      ),
    ).toBe('https://gitlab.example/group/project/-/edit/feature%2Fdocs/.slash-doc/docs/pages/page%201/content.yaml');
  });

  it('normalizes an SSH repository URL', () => {
    expect(createGitLabEditUrl('git@gitlab.example:group/project.git', 'main', 'README.md')).toBe(
      'https://gitlab.example/group/project/-/edit/main/README.md',
    );
  });
});
