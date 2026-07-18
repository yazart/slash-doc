import * as vscode from 'vscode';
import type { ImportedDocument } from './types';
import { escapeHtml, isRecord, stripHtml } from './utils';
import { importMarkdownBlocks } from './document-import-markdown';
import { importHtmlBlocks } from './document-import-html';
import { createEditorBlock } from './document-import-common';

export function importDocumentContent(text: string, source: vscode.Uri): ImportedDocument {
  const extension = source.fsPath.split('.').pop()?.toLowerCase() ?? '';
  const blocks = extension === 'html' || extension === 'htm' ? importHtmlBlocks(text) : importMarkdownBlocks(text);
  const fallbackTitle = getFileTitle(source);
  const title = getImportTitle(blocks) || fallbackTitle;
  const normalizedBlocks =
    blocks.length > 0
      ? blocks
      : [
          createEditorBlock('header', {
            text: escapeHtml(title),
            level: 2,
          }),
        ];

  if (!getImportTitle(normalizedBlocks)) {
    normalizedBlocks.unshift(
      createEditorBlock('header', {
        text: escapeHtml(title),
        level: 2,
      }),
    );
  }

  return {
    title,
    content: {
      time: Date.now(),
      blocks: normalizedBlocks,
      version: '2.30.8',
    },
  };
}

function getImportTitle(blocks: Record<string, unknown>[]): string {
  const firstHeader = blocks.find((block) => block.type === 'header' && isRecord(block.data));

  if (!firstHeader || !isRecord(firstHeader.data) || typeof firstHeader.data.text !== 'string') {
    return '';
  }

  return stripHtml(firstHeader.data.text).trim();
}

function getFileTitle(uri: vscode.Uri): string {
  const fileName = uri.fsPath.split(/[\\/]/).at(-1) ?? 'Импортированная страница';
  return fileName.replaceAll(/\.(md|markdown|html|htm)$/gi, '') || 'Импортированная страница';
}
