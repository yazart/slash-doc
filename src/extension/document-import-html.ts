import { stripHtml } from './utils';
import { createEditorBlock } from './document-import-common';
import {
  decodeHtmlEntities,
  getHtmlAttribute,
  importedCodeLanguage,
  readApiEndpointHtml,
  readApprovalTableHtml,
  readBpmnSvg,
  readCodeBlockHtml,
  readDiffBlockHtml,
  readEmbeddedDiagramDataUri,
  readFileProcessorHtml,
  readImageAnnotationHtml,
  readTaskTableHtml,
} from './document-import-readers';

export function importHtmlBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const body = extractHtmlBody(html)
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, '');
  const blockPattern =
    /<(h[1-6]|p|ul|ol|table|figure|section|div|article|main|blockquote|pre|svg)\b[^>]*>([\s\S]*?)<\/\1\s*>|<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  let consumedUntil = 0;

  while ((match = blockPattern.exec(body)) !== null) {
    appendLooseHtmlParagraph(blocks, body.slice(consumedUntil, match.index));
    consumedUntil = blockPattern.lastIndex;
    const tag = (match[1] ?? 'img').toLowerCase();
    const outer = match[0];
    const inner = match[2] ?? '';

    if (tag === 'section') {
      const apiEndpoint = readApiEndpointHtml(outer);
      const processor = readFileProcessorHtml(outer);
      const taskTable = readTaskTableHtml(outer);

      if (apiEndpoint) {
        blocks.push(createEditorBlock('apiEndpoint', apiEndpoint));
        skipUnclosedHtmlElement(body, outer, match.index, blockPattern, 'section');
        consumedUntil = blockPattern.lastIndex;
      } else if (processor) {
        blocks.push(createEditorBlock('fileProcessor', processor));
        skipUnclosedHtmlElement(body, outer, match.index, blockPattern, 'section');
        consumedUntil = blockPattern.lastIndex;
      } else if (taskTable) {
        blocks.push(createEditorBlock('taskTable', taskTable));
        skipUnclosedHtmlElement(body, outer, match.index, blockPattern, 'section');
        consumedUntil = blockPattern.lastIndex;
      } else {
        blocks.push(...importHtmlBlocks(inner));
      }

      continue;
    }

    if (tag === 'div' || tag === 'article' || tag === 'main' || tag === 'blockquote') {
      blocks.push(...importHtmlBlocks(inner));
      continue;
    }

    if (tag === 'svg') {
      const bpmn = readBpmnSvg(outer);
      if (bpmn) blocks.push(createEditorBlock(bpmn.type, bpmn.data));
      continue;
    }

    if (/^h[1-6]$/.test(tag)) {
      blocks.push(
        createEditorBlock('header', {
          text: cleanEditorHtml(inner),
          level: Number(tag.slice(1)),
        }),
      );
      continue;
    }

    if (tag === 'p') {
      const text = cleanEditorHtml(inner);

      if (stripHtml(text).trim()) {
        blocks.push(createEditorBlock('paragraph', { text }));
      }

      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      blocks.push(
        createEditorBlock('list', {
          style: tag === 'ol' ? 'ordered' : 'unordered',
          items: extractHtmlListItems(inner),
        }),
      );
      continue;
    }

    if (tag === 'table') {
      const approvalTable = readApprovalTableHtml(outer);
      if (approvalTable) {
        blocks.push(createEditorBlock('approvalTable', approvalTable));
        continue;
      }
      const htmlRows = inner.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
      blocks.push(
        createEditorBlock('confluenceTable', {
          headerRow: Boolean(htmlRows[0] && /<th\b/i.test(htmlRows[0])),
          headerColumn: htmlRows.length > 0 && htmlRows.every((row) => /^\s*<tr\b[^>]*>\s*<th\b/i.test(row)),
          rows: extractHtmlTableRows(inner),
        }),
      );
      continue;
    }

    if (tag === 'pre' && /\bclass\s*=\s*["'][^"']*\bmermaid\b/i.test(outer)) {
      blocks.push(
        createEditorBlock('mermaid', {
          code: stripHtml(decodeHtmlEntities(inner)).trim(),
          caption: '',
        }),
      );
      continue;
    }

    if (tag === 'pre') {
      const codeBlock = readCodeBlockHtml(outer);
      const diffBlock = readDiffBlockHtml(outer);

      if (codeBlock) {
        blocks.push(createEditorBlock('codeBlock', codeBlock));
        continue;
      }

      if (diffBlock) {
        blocks.push(createEditorBlock('diffBlock', diffBlock));
        continue;
      }

      const codeTag = /<code\b([^>]*)>([\s\S]*?)<\/code>/i.exec(inner);
      if (codeTag) {
        const languageName = /\blanguage-([\w#+.-]+)/i.exec(getHtmlAttribute(codeTag[1], 'class'))?.[1] ?? '';
        const source = decodeHtmlEntities(stripHtml(codeTag[2]));
        if (/^(diff|patch)$/i.test(languageName)) {
          blocks.push(createEditorBlock('diffBlock', { diff: source }));
        } else {
          blocks.push(createEditorBlock('codeBlock', { language: importedCodeLanguage(languageName), code: source }));
        }
        continue;
      }

      const text = cleanEditorHtml(inner);

      if (stripHtml(text).trim()) {
        blocks.push(createEditorBlock('paragraph', { text }));
      }

      continue;
    }

    if (tag === 'figure' || tag === 'img') {
      const imageHtml = tag === 'img' ? outer : (outer.match(/<img\b[^>]*>/i)?.[0] ?? '');
      const url = getHtmlAttribute(imageHtml, 'src');

      if (url) {
        const annotation = readImageAnnotationHtml(imageHtml);

        if (annotation) {
          blocks.push(createEditorBlock('imageAnnotation', annotation));
          if (tag === 'img') {
            skipContainingHtmlFigure(body, match.index, blockPattern);
            consumedUntil = blockPattern.lastIndex;
          }
          continue;
        }

        const embeddedDiagram = readEmbeddedDiagramDataUri(url);

        if (embeddedDiagram) {
          blocks.push(createEditorBlock(embeddedDiagram.type, embeddedDiagram.data));
          continue;
        }

        blocks.push(
          createEditorBlock('image', {
            file: { url },
            caption:
              tag === 'figure'
                ? cleanEditorHtml(outer.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '')
                : getHtmlAttribute(imageHtml, 'alt'),
            withBorder: false,
            withBackground: false,
            stretched: false,
          }),
        );
      }
    }
  }

  appendLooseHtmlParagraph(blocks, body.slice(consumedUntil));

  return blocks;
}

function appendLooseHtmlParagraph(blocks: Record<string, unknown>[], html: string): void {
  const text = cleanEditorHtml(html);

  if (stripHtml(text).trim()) {
    blocks.push(createEditorBlock('paragraph', { text }));
  }
}

function skipContainingHtmlFigure(body: string, imageIndex: number, pattern: RegExp): void {
  skipContainingHtmlElement(body, imageIndex, pattern, 'figure');
}

function skipUnclosedHtmlElement(
  body: string,
  outer: string,
  contentIndex: number,
  pattern: RegExp,
  tag: string,
): void {
  const openings = outer.match(new RegExp(`<${tag}\\b`, 'gi'))?.length ?? 0;
  const closings = outer.match(new RegExp(`</${tag}\\s*>`, 'gi'))?.length ?? 0;

  if (openings > closings) {
    skipContainingHtmlElement(body, contentIndex, pattern, tag);
  }
}

function skipContainingHtmlElement(body: string, contentIndex: number, pattern: RegExp, tag: string): void {
  const start = body.lastIndexOf(`<${tag}`, contentIndex);
  const previousEnd = body.lastIndexOf(`</${tag}>`, contentIndex);

  if (start <= previousEnd) {
    return;
  }

  const endTag = `</${tag}>`;
  const end = body.indexOf(endTag, pattern.lastIndex);

  if (end >= 0) {
    pattern.lastIndex = end + endTag.length;
  }
}

function extractHtmlBody(html: string): string {
  return /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
}

function extractHtmlListItems(html: string): string[] {
  const items: string[] = [];
  const itemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) !== null) {
    items.push(cleanEditorHtml(match[1]));
  }

  return items;
}

function extractHtmlTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      row.push(cleanEditorHtml(cellMatch[1]));
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

function cleanEditorHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replaceAll(/<\/?(div|section|article|main|header|footer)[^>]*>/gi, '')
      .replaceAll(/\s+/g, ' ')
      .trim(),
  );
}
