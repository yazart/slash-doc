import * as vscode from 'vscode';
import { extractEmbeddedImages } from '../shared/embedded-images';
import type { SlashDocSettings } from './types';
import { exportPageContent } from './document-export';
import { createCustomBlockExporter } from './custom-block-exporter';
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
  const exported = await exportPageContent(
    data,
    format,
    settings,
    createCustomBlockExporter(extensionUri, workspaceRoot),
  );
  const fileName = createPageExportFileName(getFirstHeaderText(data) || fallbackTitle, format);
  const prefix = `${fileName.replace(/\.(?:html|md)$/i, '')}-image`;
  const result = settings.exportOptions.extractImages
    ? extractEmbeddedImages(exported, prefix)
    : { content: exported, images: [] };
  const uri = vscode.Uri.joinPath(workspaceRoot, fileName);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(result.content));
  await Promise.all(
    result.images.map((image) =>
      vscode.workspace.fs.writeFile(vscode.Uri.joinPath(workspaceRoot, image.fileName), image.data),
    ),
  );
  return { uri, fileName };
}
