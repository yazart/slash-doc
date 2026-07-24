import * as vscode from 'vscode';
import type { SlashDocSettings } from './types';
import { exportPageContent } from './document-export';
import { createPageExportFileName, type PageExportFormat } from './page-export-name';
import { getFirstHeaderText } from './pages';

export { createPageExportFileName } from './page-export-name';
export type { PageExportFormat } from './page-export-name';

type SavedPageExport = {
  uri: vscode.Uri;
  fileName: string;
};

export async function savePageExport(
  workspaceRoot: vscode.Uri,
  data: unknown,
  format: PageExportFormat,
  fallbackTitle: string,
  settings: SlashDocSettings,
  extensionUri: vscode.Uri,
): Promise<SavedPageExport> {
  const content = await exportPageContent(data, format, settings, extensionUri, workspaceRoot);
  const fileName = createPageExportFileName(getFirstHeaderText(data) || fallbackTitle, format);
  const uri = vscode.Uri.joinPath(workspaceRoot, fileName);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  return { uri, fileName };
}
