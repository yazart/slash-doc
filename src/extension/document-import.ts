import * as vscode from 'vscode';
import { CODE_LANGUAGES, type CodeLanguage } from '../shared/syntax-highlighter';
import type { ImportedDocument } from './types';
import { createPageId, escapeHtml, isRecord, stripHtml } from './utils';

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

function importMarkdownBlocks(markdown: string): Record<string, unknown>[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const blocks: Record<string, unknown>[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    paragraph = [];

    if (text) {
      blocks.push(
        createEditorBlock('paragraph', {
          text: markdownInlineToHtml(text),
        }),
      );
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.includes('data-slash-doc-api-endpoint=')) {
      flushParagraph();
      const apiEndpoint = readApiEndpointHtml(trimmed);

      if (apiEndpoint) {
        blocks.push(createEditorBlock('apiEndpoint', apiEndpoint));
      }

      continue;
    }

    if (trimmed.includes('data-slash-doc-file-processor=')) {
      flushParagraph();
      const processor = readFileProcessorHtml(trimmed);
      if (processor) {
        blocks.push(createEditorBlock('fileProcessor', processor));
      }
      continue;
    }

    if (trimmed.includes('data-slash-doc-task-table=')) {
      flushParagraph();
      const taskTable = readTaskTableHtml(trimmed);
      if (taskTable) {
        blocks.push(createEditorBlock('taskTable', taskTable));
      }
      continue;
    }

    if (trimmed.includes('data-slash-doc-approval-table=')) {
      flushParagraph();
      const approvalTable = readApprovalTableHtml(trimmed);
      if (approvalTable) blocks.push(createEditorBlock('approvalTable', approvalTable));
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const codeFence = /^(`{3,})\s*([^\s`]*)\s*$/.exec(trimmed);

    if (codeFence) {
      flushParagraph();
      const code: string[] = [];
      const closingFence = codeFence[1];
      const languageName = codeFence[2].toLowerCase();
      index += 1;

      while (index < lines.length && lines[index].trim() !== closingFence) {
        code.push(lines[index]);
        index += 1;
      }

      if (languageName === 'mermaid') {
        blocks.push(
          createEditorBlock('mermaid', {
            code: code.join('\n'),
            caption: '',
          }),
        );
      } else if (languageName === 'diff' || languageName === 'patch') {
        blocks.push(createEditorBlock('diffBlock', { diff: code.join('\n') }));
      } else {
        blocks.push(
          createEditorBlock('codeBlock', {
            language: importedCodeLanguage(languageName),
            code: code.join('\n'),
          }),
        );
      }
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);

    if (heading) {
      flushParagraph();
      blocks.push(
        createEditorBlock('header', {
          text: markdownInlineToHtml(heading[2].trim()),
          level: heading[1].length,
        }),
      );
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);

    if (image) {
      flushParagraph();
      const embeddedDiagram = readEmbeddedDiagramDataUri(image[2].trim());

      if (embeddedDiagram) {
        blocks.push(createEditorBlock(embeddedDiagram.type, embeddedDiagram.data));

        if (embeddedDiagram.type === 'imageAnnotation' && isMarkdownTableStart(lines, index + 1)) {
          index += 2;

          while (index + 1 < lines.length && isMarkdownTableLine(lines[index + 1])) {
            index += 1;
          }
        }

        continue;
      }

      blocks.push(
        createEditorBlock('image', {
          file: {
            url: image[2].trim(),
          },
          caption: markdownInlineToHtml(image[1].trim()),
          withBorder: false,
          withBackground: false,
          stretched: false,
        }),
      );
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      flushParagraph();
      const tableLines: string[] = [];

      while (index < lines.length && isMarkdownTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      index -= 1;
      blocks.push(
        createEditorBlock('confluenceTable', {
          headerRow: true,
          headerColumn: false,
          rows: markdownTableToRows(tableLines),
        }),
      );
      continue;
    }

    const list = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(line);

    if (list) {
      flushParagraph();
      const ordered = /\d+[.)]/.test(list[2]);
      const items: string[] = [];

      while (index < lines.length) {
        const item = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(lines[index]);

        if (!item || /\d+[.)]/.test(item[2]) !== ordered) {
          break;
        }

        items.push(markdownInlineToHtml(item[3].trim()));
        index += 1;
      }

      index -= 1;
      blocks.push(
        createEditorBlock('list', {
          style: ordered ? 'ordered' : 'unordered',
          items,
        }),
      );
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

function importHtmlBlocks(html: string): Record<string, unknown>[] {
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

function importedCodeLanguage(value: string): CodeLanguage {
  const aliases: Record<string, CodeLanguage> = {
    'c#': 'csharp',
    cs: 'csharp',
    js: 'javascript',
    ts: 'typescript',
    yml: 'yaml',
    py: 'python',
    shell: 'bash',
    sh: 'bash',
  };
  const normalized = aliases[value.toLowerCase()] ?? value.toLowerCase();
  return CODE_LANGUAGES.some((language) => language.id === normalized) ? (normalized as CodeLanguage) : 'javascript';
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

type EmbeddedDiagram = {
  type: 'flowDesigner' | 'networkCanvas' | 'imageAnnotation';
  data: Record<string, unknown>;
};

function readEmbeddedDiagramDataUri(uri: string): EmbeddedDiagram | undefined {
  if (!/^data:image\/svg\+xml(?:;[^,]*)?,/i.test(uri)) {
    return undefined;
  }

  const separator = uri.indexOf(',');

  if (separator < 0) {
    return undefined;
  }

  try {
    const header = uri.slice(0, separator);
    const payload = uri.slice(separator + 1);
    const svg = /;base64(?:;|$)/i.test(header)
      ? Buffer.from(payload, 'base64').toString('utf8')
      : decodeURIComponent(payload);
    const metadata =
      /<metadata\b[^>]*\bid=["']slash-doc-(flow|network|image-annotation)-data["'][^>]*>([\s\S]*?)<\/metadata>/i.exec(
        svg,
      );

    if (!metadata) {
      return undefined;
    }

    const json = metadata[2]
      .replace(/^\s*<!\[CDATA\[/, '')
      .replace(/\]\]>\s*$/, '')
      .replaceAll(/\]\]>\s*<!\[CDATA\[/g, '');
    const parsed = JSON.parse(json);

    if (!isRecord(parsed)) {
      return undefined;
    }

    return {
      type:
        metadata[1].toLowerCase() === 'network'
          ? 'networkCanvas'
          : metadata[1].toLowerCase() === 'image-annotation'
            ? 'imageAnnotation'
            : 'flowDesigner',
      data: parsed,
    };
  } catch {
    return undefined;
  }
}

function readImageAnnotationHtml(imageHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(imageHtml, 'data-slash-doc-annotation');

  if (!encoded) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readApiEndpointHtml(sectionHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(sectionHtml, 'data-slash-doc-api-endpoint');

  if (!encoded) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readFileProcessorHtml(sectionHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(sectionHtml, 'data-slash-doc-file-processor');
  if (!encoded) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readTaskTableHtml(sectionHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(sectionHtml, 'data-slash-doc-task-table');
  if (!encoded) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readApprovalTableHtml(tableHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(tableHtml, 'data-slash-doc-approval-table');
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readCodeBlockHtml(preHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(preHtml, 'data-slash-doc-code');
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!isRecord(parsed)) return undefined;
    return {
      language: importedCodeLanguage(typeof parsed.language === 'string' ? parsed.language : ''),
      code: typeof parsed.code === 'string' ? parsed.code : '',
    };
  } catch {
    return undefined;
  }
}

function readDiffBlockHtml(preHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(preHtml, 'data-slash-doc-diff');
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? { diff: typeof parsed.diff === 'string' ? parsed.diff : '' } : undefined;
  } catch {
    return undefined;
  }
}

function readBpmnSvg(
  svgHtml: string,
): { type: 'bpmnModeler' | 'bpmnPreview'; data: Record<string, unknown> } | undefined {
  const kind = getHtmlAttribute(svgHtml, 'data-slash-doc-bpmn');
  const encoded = getHtmlAttribute(svgHtml, 'data-slash-doc-bpmn-state');
  if ((kind !== 'modeler' && kind !== 'preview') || !encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!isRecord(parsed)) return undefined;
    return {
      type: kind === 'modeler' ? 'bpmnModeler' : 'bpmnPreview',
      data: {
        xml: typeof parsed.xml === 'string' ? parsed.xml : '',
        fileName: typeof parsed.fileName === 'string' ? parsed.fileName : undefined,
        svg: svgHtml,
      },
    };
  } catch {
    return undefined;
  }
}

function createEditorBlock(type: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    id: createPageId(),
    type,
    data,
  };
}

function markdownInlineToHtml(value: string): string {
  return escapeHtml(value)
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replaceAll(/__([^_]+)__/g, '<b>$1</b>')
    .replaceAll(/\*([^*]+)\*/g, '<i>$1</i>')
    .replaceAll(/_([^_]+)_/g, '<i>$1</i>')
    .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return (
    isMarkdownTableLine(lines[index]) &&
    index + 1 < lines.length &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function isMarkdownTableLine(line: string): boolean {
  return line.includes('|') && line.trim().length > 0;
}

function markdownTableToRows(lines: string[]): string[][] {
  return lines
    .filter((line, index) => index !== 1)
    .map((line) =>
      line
        .trim()
        .replaceAll(/^\||\|$/g, '')
        .split('|')
        .map((cell) => markdownInlineToHtml(cell.trim())),
    )
    .filter((row) => row.some((cell) => stripHtml(cell).trim().length > 0));
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

function getHtmlAttribute(html: string, attribute: string): string {
  const pattern = new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(html);
  return decodeHtmlEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? '');
}

function cleanEditorHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replaceAll(/<\/?(div|section|article|main|header|footer)[^>]*>/gi, '')
      .replaceAll(/\s+/g, ' ')
      .trim(),
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };

  return value.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();

    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }

    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }

    return named[normalized] ?? entity;
  });
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
