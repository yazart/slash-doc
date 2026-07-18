import type { ApiSchemaField } from '../shared/api-endpoint';

export function mapApiSchemaFields(
  fields: ApiSchemaField[],
  id: string,
  update: (field: ApiSchemaField) => ApiSchemaField,
): ApiSchemaField[] {
  return fields.map((field) =>
    field.id === id ? update(field) : { ...field, children: mapApiSchemaFields(field.children, id, update) },
  );
}

export function removeApiSchemaField(fields: ApiSchemaField[], id: string): ApiSchemaField[] {
  return fields
    .filter((field) => field.id !== id)
    .map((field) => ({ ...field, children: removeApiSchemaField(field.children, id) }));
}

export function highlightApiCode(code: string, language: 'typescript' | 'json'): string {
  const keywords = new Set(
    language === 'json'
      ? ['true', 'false', 'null']
      : [
          'as',
          'async',
          'await',
          'boolean',
          'break',
          'case',
          'catch',
          'class',
          'const',
          'constructor',
          'continue',
          'default',
          'delete',
          'do',
          'else',
          'export',
          'extends',
          'false',
          'finally',
          'for',
          'from',
          'function',
          'if',
          'implements',
          'import',
          'in',
          'instanceof',
          'interface',
          'let',
          'new',
          'null',
          'number',
          'of',
          'private',
          'protected',
          'public',
          'readonly',
          'return',
          'static',
          'string',
          'super',
          'switch',
          'this',
          'throw',
          'true',
          'try',
          'type',
          'typeof',
          'undefined',
          'unknown',
          'void',
          'while',
        ],
  );
  const pattern =
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][A-Za-z0-9_$]*\b|[{}\[\](),.;:?<>+=\-*/]/g;
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    output += escapeCode(code.slice(cursor, match.index));
    const token = match[0];
    const rest = code.slice(pattern.lastIndex);
    let kind = '';
    if (token.startsWith('//') || token.startsWith('/*')) kind = 'comment';
    else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`'))
      kind = /^\s*:/.test(rest) ? 'property' : 'string';
    else if (/^\d/.test(token)) kind = 'number';
    else if (keywords.has(token)) kind = 'keyword';
    else if (/^[A-Za-z_$]/.test(token) && /^\s*:/.test(rest)) kind = 'property';
    else if (/^[{}\[\](),.;:?<>+=\-*/]$/.test(token)) kind = 'punctuation';
    output += kind ? `<span class="syntax-${kind}">${escapeCode(token)}</span>` : escapeCode(token);
    cursor = pattern.lastIndex;
  }
  return output + escapeCode(code.slice(cursor));
}

function escapeCode(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
