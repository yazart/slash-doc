import * as vscode from 'vscode';
import { decodeStoredPage, encodeStoredPage, isManagedPageResource } from '../shared/page-storage-format';
import { removePageTime } from '../shared/page-content';
import { getLegacyPageContentUri, getPageContentUri, getPageRootUri, pathExists } from './filesystem';

export async function readStoredPageContent(workspaceRoot: vscode.Uri, pageId: string): Promise<unknown | undefined> {
  const pageRoot = getPageRootUri(workspaceRoot, pageId);
  const yamlUri = getPageContentUri(workspaceRoot, pageId);
  const jsonUri = getLegacyPageContentUri(workspaceRoot, pageId);
  if (await pathExists(yamlUri)) {
    try {
      const source = new TextDecoder().decode(await vscode.workspace.fs.readFile(yamlUri));
      return removePageTime(
        await decodeStoredPage(source, async (fileName) =>
          vscode.workspace.fs.readFile(vscode.Uri.joinPath(pageRoot, fileName)),
        ),
      );
    } catch (error) {
      if (!(await pathExists(jsonUri))) throw error;
    }
  }
  if (await pathExists(jsonUri)) {
    return removePageTime(JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(jsonUri))));
  }
  return undefined;
}

export async function saveStoredPageContent(workspaceRoot: vscode.Uri, pageId: string, value: unknown): Promise<void> {
  const stored = encodeStoredPage(removePageTime(value));
  const pageRoot = getPageRootUri(workspaceRoot, pageId);
  await vscode.workspace.fs.createDirectory(pageRoot);
  await Promise.all(
    stored.resources.map((resource) =>
      vscode.workspace.fs.writeFile(vscode.Uri.joinPath(pageRoot, resource.fileName), resource.data),
    ),
  );
  await replaceTextFile(getPageContentUri(workspaceRoot, pageId), stored.yaml);
  await deleteIfExists(getLegacyPageContentUri(workspaceRoot, pageId));
  await removeUnusedResources(pageRoot, new Set(stored.resources.map((resource) => resource.fileName)));
}

async function replaceTextFile(uri: vscode.Uri, content: string): Promise<void> {
  const temporary = uri.with({ path: `${uri.path}.tmp` });
  await vscode.workspace.fs.writeFile(temporary, new TextEncoder().encode(content));
  await vscode.workspace.fs.rename(temporary, uri, { overwrite: true });
}

async function deleteIfExists(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.delete(uri, { useTrash: false }).then(
    () => undefined,
    () => undefined,
  );
}

async function removeUnusedResources(pageRoot: vscode.Uri, used: Set<string>): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(pageRoot);
  await Promise.all(
    entries
      .filter(([name, type]) => type === vscode.FileType.File && isManagedPageResource(name) && !used.has(name))
      .map(([name]) => vscode.workspace.fs.delete(vscode.Uri.joinPath(pageRoot, name), { useTrash: false })),
  );
}
