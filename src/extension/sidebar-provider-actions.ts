import * as vscode from 'vscode';
import { compileDocumentationSite } from './site-compiler';
import { getGlobalAddonRootUri, getGlobalApiRootUri, getWorkspaceRoot, writeJsonIfMissing } from './filesystem';
import { getDefaultSettings } from './settings';

export async function initializeDocumentation(extensionUri: vscode.Uri, silent = false): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage('Откройте папку рабочей области перед инициализацией Slash Doc.');
    return;
  }
  const slashDocRoot = vscode.Uri.joinPath(workspaceRoot, '.slash-doc');
  const docsRoot = vscode.Uri.joinPath(slashDocRoot, 'docs');
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(docsRoot, 'pages'));
  await vscode.workspace.fs.createDirectory(getGlobalApiRootUri(extensionUri));
  await vscode.workspace.fs.createDirectory(getGlobalAddonRootUri(extensionUri));
  await writeJsonIfMissing(vscode.Uri.joinPath(slashDocRoot, 'sdsettings.json'), getDefaultSettings());
  await writeJsonIfMissing(vscode.Uri.joinPath(docsRoot, 'menu.json'), { items: [] });
  if (!silent) void vscode.window.showInformationMessage('Документация Slash Doc инициализирована.');
}

export async function compileDocumentation(extensionUri: vscode.Uri): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage('Откройте папку рабочей области перед сборкой документации.');
    return;
  }
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: workspaceRoot,
    openLabel: 'Собрать документацию сюда',
    title: 'Папка для HTML-документации',
  });
  const outputRoot = folders?.[0];
  if (!outputRoot) return;
  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Сборка Slash Doc в HTML…' },
      () => compileDocumentationSite(extensionUri, workspaceRoot, outputRoot),
    );
    const action = await vscode.window.showInformationMessage(
      `Собрано страниц: ${result.pageCount}.`,
      'Открыть документацию',
    );
    if (action === 'Открыть документацию') await vscode.env.openExternal(result.indexUri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Не удалось собрать документацию: ${message}`);
  }
}
