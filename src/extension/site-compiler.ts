import * as vscode from 'vscode';
import { extractEmbeddedImages } from '../shared/embedded-images';
import { createCustomBlockExporter } from './custom-block-exporter';
import { exportPageContent } from './document-export';
import { getDocumentationSearchText } from './documentation-search-text';
import { readMenu, readPageContent } from './pages';
import { readSettings } from './settings-store';
import { flattenPages, prepareCompiledPage, renderHostHtml } from './site-renderer';
import { readPageRevisionMetadata, resolvePageRevisionFile, resolvePageYamlFile } from '../shared/page-revision';

export type CompiledDocumentation = {
  indexUri: vscode.Uri;
  pageCount: number;
};

export async function compileDocumentationSite(
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  outputRoot: vscode.Uri,
): Promise<CompiledDocumentation> {
  const menu = await readMenu(workspaceRoot);
  const settings = await readSettings(workspaceRoot);
  const pages = flattenPages(menu.items);
  const pageIds = new Set(pages.map((page) => page.id));
  const pagesRoot = vscode.Uri.joinPath(outputRoot, 'pages');
  const searchIndex: Array<{ pageId: string; title: string; text: string }> = [];
  const customExporter = createCustomBlockExporter(extensionUri, workspaceRoot);
  await vscode.workspace.fs.createDirectory(outputRoot);
  await vscode.workspace.fs.createDirectory(pagesRoot);

  for (const page of pages) {
    const data = await readPageContent(workspaceRoot, page.id, page.title);
    const revision = await readPageRevisionMetadata(
      workspaceRoot.fsPath,
      await resolvePageRevisionFile(workspaceRoot.fsPath, page.id),
      settings.exportOptions.repositoryUrl,
      resolvePageYamlFile(workspaceRoot.fsPath, page.id),
    );
    searchIndex.push({ pageId: page.id, title: page.title, text: getDocumentationSearchText(data) });
    const exported = prepareCompiledPage(
      await exportPageContent(data, 'html', settings, customExporter),
      page.id,
      pageIds,
      revision,
    );
    const result = settings.exportOptions.separateFiles
      ? extractEmbeddedImages(exported, `${page.id}-image`)
      : { content: exported, images: [] };
    await writeText(vscode.Uri.joinPath(pagesRoot, `${page.id}.html`), result.content);
    await Promise.all(
      result.images.map((image) =>
        vscode.workspace.fs.writeFile(vscode.Uri.joinPath(pagesRoot, image.fileName), image.data),
      ),
    );
  }

  const projectName = workspaceRoot.path.split('/').filter(Boolean).at(-1) ?? 'Документация';
  const indexUri = vscode.Uri.joinPath(outputRoot, 'index.html');
  await writeText(indexUri, renderHostHtml(projectName, menu.items, pages[0]?.id, searchIndex));
  return { indexUri, pageCount: pages.length };
}

async function writeText(uri: vscode.Uri, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}
