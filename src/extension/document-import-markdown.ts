import {
  createEditorBlock,
  isMarkdownTableLine,
  isMarkdownTableStart,
  markdownInlineToHtml,
  markdownTableToRows,
} from './document-import-common';
import { migrateApprovalTableData } from '../shared/approval-table-migration';
import {
  importedCodeLanguage,
  readApiEndpointHtml,
  readApprovalTableHtml,
  readEmbeddedDiagramDataUri,
  readFileProcessorHtml,
  readMkDocsWidgetHtml,
  readTaskTableHtml,
} from './document-import-readers';

export function importMarkdownBlocks(markdown: string): Record<string, unknown>[] {
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

    if (trimmed.startsWith('<details') && trimmed.includes('data-slash-doc-mkdocs-details=')) {
      const html = [line];
      while (!html.at(-1)?.includes('</details>') && index + 1 < lines.length) {
        index += 1;
        html.push(lines[index]);
      }
      const widget = readMkDocsWidgetHtml(html.join('\n'));
      if (widget) {
        flushParagraph();
        blocks.push(createEditorBlock(widget.type, widget.data));
        continue;
      }
    }

    const checklist = readMkDocsChecklist(lines, index);
    if (checklist) {
      flushParagraph();
      blocks.push(createEditorBlock('mkdocsChecklist', { items: checklist.items }));
      index = checklist.endIndex;
      continue;
    }

    const tabs = readMkDocsTabs(lines, index);
    if (tabs) {
      flushParagraph();
      blocks.push(createEditorBlock('mkdocsTabs', { tabs: tabs.tabs }));
      index = tabs.endIndex;
      continue;
    }

    const admonition = readMkDocsAdmonition(lines, index);
    if (admonition) {
      flushParagraph();
      blocks.push(createEditorBlock('mkdocsAdmonition', admonition.data));
      index = admonition.endIndex;
      continue;
    }

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
      if (approvalTable) blocks.push(createEditorBlock('confluenceTable', migrateApprovalTableData(approvalTable)));
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

function readMkDocsAdmonition(
  lines: string[],
  startIndex: number,
): { data: Record<string, unknown>; endIndex: number } | undefined {
  const match = /^(!!!|\?\?\?\+?)\s+([\w-]+)(?:\s+["'](.*)["'])?\s*$/.exec(lines[startIndex].trim());
  if (!match) return undefined;
  const body: string[] = [];
  let index = startIndex + 1;
  if (index < lines.length && !lines[index].trim()) index += 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith('    ') || line.startsWith('\t')) {
      body.push(line.startsWith('\t') ? line.slice(1) : line.slice(4));
      index += 1;
      continue;
    }
    if (!line.trim()) {
      body.push('');
      index += 1;
      continue;
    }
    break;
  }
  while (body.at(-1) === '') body.pop();
  return {
    data: {
      kind: match[2],
      title: match[3] ?? match[2],
      content: body.join('\n'),
      collapsible: match[1].startsWith('???'),
      open: match[1] === '???+',
    },
    endIndex: Math.max(startIndex, index - 1),
  };
}

function readMkDocsChecklist(
  lines: string[],
  startIndex: number,
): { items: Array<{ id: string; text: string; checked: boolean; level: number }>; endIndex: number } | undefined {
  if (!/^[\t ]*[-*+]\s+\[[ xX]\]\s+/.test(lines[startIndex])) return undefined;
  const items: Array<{ id: string; text: string; checked: boolean; level: number }> = [];
  let index = startIndex;
  let previousLevel = 0;
  while (index < lines.length) {
    const match = /^([\t ]*)[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lines[index]);
    if (!match) break;
    const width = match[1].replaceAll('\t', '    ').length;
    const requested = Math.floor(width / 4);
    const level = items.length === 0 ? 0 : Math.min(requested, previousLevel + 1);
    previousLevel = level;
    items.push({
      id: `task-${startIndex}-${items.length}`,
      text: match[3].trim(),
      checked: match[2].toLowerCase() === 'x',
      level,
    });
    index += 1;
  }
  return { items, endIndex: index - 1 };
}

function readMkDocsTabs(
  lines: string[],
  startIndex: number,
): { tabs: Array<{ id: string; title: string; content: string }>; endIndex: number } | undefined {
  if (!/^===\s+["'].+["']\s*$/.test(lines[startIndex].trim())) return undefined;
  const tabs: Array<{ id: string; title: string; content: string }> = [];
  let index = startIndex;
  while (index < lines.length) {
    const heading = /^===\s+["'](.+)["']\s*$/.exec(lines[index].trim());
    if (!heading) break;
    index += 1;
    if (index < lines.length && !lines[index].trim()) index += 1;
    const body: string[] = [];
    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith('    ') || line.startsWith('\t')) {
        body.push(line.startsWith('\t') ? line.slice(1) : line.slice(4));
        index += 1;
        continue;
      }
      if (!line.trim()) {
        body.push('');
        index += 1;
        continue;
      }
      break;
    }
    while (body.at(-1) === '') body.pop();
    tabs.push({ id: `tab-${startIndex}-${tabs.length}`, title: heading[1], content: body.join('\n') });
  }
  return tabs.length > 0 ? { tabs, endIndex: Math.max(startIndex, index - 1) } : undefined;
}
