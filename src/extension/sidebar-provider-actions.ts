import * as vscode from 'vscode';
import { compileDocumentationSite } from './site-compiler';
import { compileMarkdownDocumentation } from './markdown-site-compiler';
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

export async function compileDocumentation(
  extensionUri: vscode.Uri,
  saveOpenPage?: () => Promise<boolean>,
  format: 'html' | 'md' = 'html',
): Promise<void> {
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
    title: `Папка для ${format === 'html' ? 'HTML' : 'Markdown'}-документации`,
  });
  const outputRoot = folders?.[0];
  if (!outputRoot) return;
  if (saveOpenPage && !(await saveOpenPage())) {
    void vscode.window.showErrorMessage('Сборка отменена: не удалось сохранить открытую страницу.');
    return;
  }
  try {
    const result = await vscode.window.withProgress<{
      pageCount: number;
      indexUri?: vscode.Uri;
      contentsUri?: vscode.Uri;
    }>(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Сборка Slash Doc в ${format === 'html' ? 'HTML' : 'Markdown'}…`,
      },
      async () =>
        format === 'html'
          ? await compileDocumentationSite(extensionUri, workspaceRoot, outputRoot)
          : await compileMarkdownDocumentation(extensionUri, workspaceRoot, outputRoot),
    );
    const action = await vscode.window.showInformationMessage(
      `Собрано страниц: ${result.pageCount}.`,
      format === 'html' ? 'Открыть документацию' : 'Открыть содержание',
    );
    if (format === 'html' && action === 'Открыть документацию' && result.indexUri) {
      await vscode.env.openExternal(result.indexUri);
    }
    if (format === 'md' && action === 'Открыть содержание' && result.contentsUri) {
      await vscode.commands.executeCommand('vscode.open', result.contentsUri);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Не удалось собрать документацию: ${message}`);
  }
}
