import * as vscode from 'vscode';
import type { ApiService, CustomAddonWebviewModule, CustomEditorAddon, SlashDocSettings } from './types';

export function getWorkspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

export async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function writeJsonIfMissing(uri: vscode.Uri, value: unknown): Promise<void> {
  if (!(await pathExists(uri))) {
    await writeJson(uri, value);
  }
}

export async function writeJson(uri: vscode.Uri, value: unknown): Promise<void> {
  const content = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  await vscode.workspace.fs.writeFile(uri, content);
}

export async function writeTextIfMissing(uri: vscode.Uri, value: string): Promise<void> {
  if (!(await pathExists(uri))) {
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(value));
  }
}

export function getMenuUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'docs', 'menu.json');
}

export function getSettingsUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'sdsettings.json');
}

export function getGlobalApiRootUri(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, 'api');
}

export function getApiServiceUri(
  extensionUri: vscode.Uri,
  _workspaceRoot: vscode.Uri,
  service: ApiService,
): vscode.Uri {
  return vscode.Uri.joinPath(getGlobalApiRootUri(extensionUri), service.file);
}

export function getGlobalAddonRootUri(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, 'addons');
}

export function getCustomAddonUri(
  extensionUri: vscode.Uri,
  _workspaceRoot: vscode.Uri,
  addon: CustomEditorAddon,
): vscode.Uri {
  return vscode.Uri.joinPath(getGlobalAddonRootUri(extensionUri), addon.file);
}

export function getCustomAddonWebviewModules(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
  settings: SlashDocSettings,
): CustomAddonWebviewModule[] {
  if (!workspaceRoot) {
    return [];
  }

  return settings.customEditorAddons
    .filter((addon) => addon.enabled)
    .map((addon) => ({
      id: addon.id,
      toolName: addon.toolName,
      uri: webview.asWebviewUri(getCustomAddonUri(extensionUri, workspaceRoot, addon)).toString(),
    }));
}

export function getPagesRootUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'docs', 'pages');
}

export function getPageContentUri(workspaceRoot: vscode.Uri, pageId: string): vscode.Uri {
  return vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), pageId, 'content.json');
}
