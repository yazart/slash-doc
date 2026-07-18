import {
  createEditorBlock,
  isMarkdownTableLine,
  isMarkdownTableStart,
  markdownInlineToHtml,
  markdownTableToRows,
} from './document-import-common';
import {
  importedCodeLanguage,
  readApiEndpointHtml,
  readApprovalTableHtml,
  readEmbeddedDiagramDataUri,
  readFileProcessorHtml,
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
