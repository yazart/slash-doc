import * as vscode from 'vscode';
import {
  createDocumentationTree,
  renderMarkdownContents,
  rewriteMarkdownPageLinks,
} from '../shared/documentation-tree';
import { extractEmbeddedImages } from '../shared/embedded-images';
import { createCustomBlockExporter } from './custom-block-exporter';
import { exportPageContent } from './document-export';
import { readMenu, readPageContent } from './pages';
import { readSettings } from './settings-store';

export type CompiledMarkdownDocumentation = {
  contentsUri: vscode.Uri;
  pageCount: number;
};

export async function compileMarkdownDocumentation(
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  outputRoot: vscode.Uri,
): Promise<CompiledMarkdownDocumentation> {
  const menu = await readMenu(workspaceRoot);
  const settings = await readSettings(workspaceRoot);
  const pages = createDocumentationTree(menu.items);
  const customExporter = createCustomBlockExporter(extensionUri, workspaceRoot);
  await vscode.workspace.fs.createDirectory(outputRoot);

  for (const current of pages) {
    const pageRoot = vscode.Uri.joinPath(outputRoot, ...current.directories);
    await vscode.workspace.fs.createDirectory(pageRoot);
    const data = await readPageContent(workspaceRoot, current.page.id, current.page.title);
    const markdown = rewriteMarkdownPageLinks(
      await exportPageContent(data, 'md', settings, customExporter),
      current,
      pages,
    );
    const result = settings.exportOptions.separateFiles
      ? extractEmbeddedImages(markdown)
      : { content: markdown, images: [] };
    await writeText(vscode.Uri.joinPath(pageRoot, 'content.md'), result.content);
    await Promise.all(
      result.images.map((image) =>
        vscode.workspace.fs.writeFile(vscode.Uri.joinPath(pageRoot, image.fileName), image.data),
      ),
    );
  }

  const contentsUri = vscode.Uri.joinPath(outputRoot, 'contents.md');
  await writeText(contentsUri, renderMarkdownContents(menu.items, pages));
  return { contentsUri, pageCount: pages.length };
}

async function writeText(uri: vscode.Uri, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}
