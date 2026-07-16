import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import diff from 'highlight.js/lib/languages/diff';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import nginx from 'highlight.js/lib/languages/nginx';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';

export const CODE_LANGUAGES = [
  { id: 'csharp', label: 'C#' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'python', label: 'Python' },
  { id: 'nginx', label: 'nginx' },
  { id: 'toml', label: 'TOML' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['id'];

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('toml', ini);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('yaml', yaml);

export function normalizeCodeLanguage(value: unknown): CodeLanguage {
  return CODE_LANGUAGES.some((language) => language.id === value) ? (value as CodeLanguage) : 'javascript';
}

export function highlightSource(source: string, language: CodeLanguage | 'diff'): string {
  return hljs.highlight(source, { language, ignoreIllegals: true }).value;
}
