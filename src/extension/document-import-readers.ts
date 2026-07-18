import { CODE_LANGUAGES, type CodeLanguage } from '../shared/syntax-highlighter';
import { isRecord } from './utils';

export function importedCodeLanguage(value: string): CodeLanguage {
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

type EmbeddedDiagram = {
  type: 'flowDesigner' | 'networkCanvas' | 'imageAnnotation';
  data: Record<string, unknown>;
};

export function readEmbeddedDiagramDataUri(uri: string): EmbeddedDiagram | undefined {
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

export function readImageAnnotationHtml(imageHtml: string): Record<string, unknown> | undefined {
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

export function readApiEndpointHtml(sectionHtml: string): Record<string, unknown> | undefined {
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

export function readFileProcessorHtml(sectionHtml: string): Record<string, unknown> | undefined {
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

export function readTaskTableHtml(sectionHtml: string): Record<string, unknown> | undefined {
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

export function readApprovalTableHtml(tableHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(tableHtml, 'data-slash-doc-approval-table');
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function readCodeBlockHtml(preHtml: string): Record<string, unknown> | undefined {
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

export function readDiffBlockHtml(preHtml: string): Record<string, unknown> | undefined {
  const encoded = getHtmlAttribute(preHtml, 'data-slash-doc-diff');
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return isRecord(parsed) ? { diff: typeof parsed.diff === 'string' ? parsed.diff : '' } : undefined;
  } catch {
    return undefined;
  }
}

export function readBpmnSvg(
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

export function getHtmlAttribute(html: string, attribute: string): string {
  const pattern = new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(html);
  return decodeHtmlEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? '');
}

export function decodeHtmlEntities(value: string): string {
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
