import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Git page history panel', () => {
  it('defines commit selectors and block status colors', async () => {
    const panel = await readFile(join(process.cwd(), 'src/webview/page-history-panel.ts'), 'utf8');
    const styles = await readFile(join(process.cwd(), 'src/webview/page-history-panel.css'), 'utf8');

    expect(panel).toContain("versionSelect('Первая версия')");
    expect(panel).toContain("versionSelect('Следующая версия')");
    expect(panel).toContain("iconButton('История Git', LUCIDE_ICONS.history)");
    expect(panel).toContain("iconButton('Сравнение версий', LUCIDE_ICONS.fileDiff)");
    expect(panel).toContain("versionSelect('Версия')");
    expect(panel).toContain('`${commits.length - index - 1} · ${date} · ${commit.author} · ${commit.subject}`');
    expect(panel).not.toContain('`${commit.shortHash} · ${date}');
    expect(styles).toMatch(/data-git-diff='added'[^}]*background:/s);
    expect(styles).toMatch(/data-git-diff='modified'[^}]*background:/s);
    expect(styles).toMatch(/data-git-diff='removed'[^}]*background:/s);
    expect(styles).toMatch(/\.git-history-legend\[hidden\]\s*{[^}]*display:\s*none/s);
  });

  it('keeps historical content read-only and scrollable with explicit exits for both modes', async () => {
    const panel = await readFile(join(process.cwd(), 'src/webview/page-history-panel.ts'), 'utf8');
    const styles = await readFile(join(process.cwd(), 'src/webview/page-history-panel.css'), 'utf8');

    expect(panel).not.toContain('view.viewer.inert = true');
    expect(panel).toContain("view.viewer.setAttribute('aria-readonly', 'true')");
    expect(styles).toMatch(/\.git-history-viewer\s*{[^}]*overflow:\s*auto/s);
    expect(styles).toMatch(/aria-readonly='true'[^}]*\.ce-block[^}]*pointer-events:\s*none/s);
    expect(panel).toContain("comparison ? 'Выйти из сравнения' : 'Выйти из просмотра'");
    expect(panel).toContain("if (event.key === 'Escape') close()");
  });
});
