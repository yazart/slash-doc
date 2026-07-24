import { LUCIDE_ICONS } from './lucide-icons';
import styles from './file-processor-tool.shadow.css?raw';
import { createToolSurface } from './tool-surface';
import { FILE_PROCESSOR_TEMPLATE } from './file-processor-template';

export type ProcessorFileInfo = { name: string; size: number; modified: number };
export type FileProcessorData = {
  script: string;
  files: ProcessorFileInfo[];
  results: ProcessorFileInfo[];
  stdout: string;
  stderr: string;
  lastRun?: number;
};

export type FileProcessorBridge = {
  upload(
    files: Array<{ name: string; dataUrl: string }>,
  ): Promise<{ files: ProcessorFileInfo[]; uploaded: ProcessorFileInfo[] }>;
  run(
    script: string,
    inputFiles: string[],
  ): Promise<{ files: ProcessorFileInfo[]; results: ProcessorFileInfo[]; stdout: string; stderr: string }>;
  download(fileName: string): Promise<void>;
};

type ToolArgs = { data?: Partial<FileProcessorData> };

declare global {
  interface Window {
    __SLASH_DOC_FILE_PROCESSOR__?: FileProcessorBridge;
  }
}

const defaultScript = `const fs = require('node:fs/promises');
const { parse, stringify } = require('csv/sync');

const source = await fs.readFile('data.csv', 'utf8');
const rows = parse(source, { columns: true, skip_empty_lines: true });

// Здесь можно изменить или отфильтровать строки.
const result = rows.map((row, index) => ({ ...row, rowNumber: index + 1 }));

await fs.writeFile('result.csv', stringify(result, { header: true }));
console.log(\`Обработано строк: \${result.length}\`);`;

export default class FileProcessorTool {
  private data: FileProcessorData;
  private wrapper?: HTMLDivElement;
  private scriptInput?: HTMLTextAreaElement;
  private scriptHighlight?: HTMLElement;
  private fileList?: HTMLDivElement;
  private resultList?: HTMLDivElement;
  private consoleOutput?: HTMLPreElement;
  private status?: HTMLSpanElement;

  static get toolbox() {
    return {
      title: 'Обработчик файлов',
      icon: LUCIDE_ICONS.fileCog,
    };
  }

  constructor({ data }: ToolArgs) {
    this.data = {
      script: typeof data?.script === 'string' ? data.script : defaultScript,
      files: normalizeFiles(data?.files),
      results: normalizeFiles(data?.results),
      stdout: typeof data?.stdout === 'string' ? data.stdout : '',
      stderr: typeof data?.stderr === 'string' ? data.stderr : '',
      lastRun: typeof data?.lastRun === 'number' ? data.lastRun : undefined,
    };
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'slash-file-processor-surface');
    const wrapper = document.createElement('div');
    wrapper.className = 'slash-file-processor-tool';
    wrapper.innerHTML = FILE_PROCESSOR_TEMPLATE;
    this.wrapper = wrapper;
    this.scriptInput = wrapper.querySelector('.fp-script') ?? undefined;
    this.scriptHighlight = wrapper.querySelector('.fp-highlight') ?? undefined;
    this.fileList = wrapper.querySelector('.fp-input-files') ?? undefined;
    this.resultList = wrapper.querySelector('.fp-results') ?? undefined;
    this.consoleOutput = wrapper.querySelector('.fp-console') ?? undefined;
    this.status = wrapper.querySelector('.fp-status') ?? undefined;
    if (this.scriptInput) {
      this.scriptInput.value = this.data.script;
      this.updateHighlight();
      this.scriptInput.addEventListener('input', () => {
        this.data.script = this.scriptInput?.value ?? '';
        this.updateHighlight();
        this.changed();
      });
      this.scriptInput.addEventListener('scroll', () => this.syncHighlightScroll());
      this.scriptInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.stopPropagation();
        }
      });
    }
    const input = wrapper.querySelector<HTMLInputElement>('.fp-input');
    const drop = wrapper.querySelector<HTMLElement>('.fp-drop');
    wrapper.querySelector('.fp-select')?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => {
      void this.upload(Array.from(input.files ?? []));
      input.value = '';
    });
    drop?.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('drag');
    });
    drop?.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop?.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('drag');
      void this.upload(Array.from(event.dataTransfer?.files ?? []));
    });
    wrapper.querySelector('.fp-run')?.addEventListener('click', () => void this.run());
    this.refresh();
    surface.content.append(wrapper);
    return surface;
  }

  save(): FileProcessorData {
    return { ...this.data, script: this.scriptInput?.value ?? this.data.script };
  }

  private async upload(files: File[]): Promise<void> {
    const supported = files.filter((file) => /\.(csv|json)$/i.test(file.name));
    if (supported.length === 0) {
      this.setStatus('Выберите CSV или JSON файл', true);
      return;
    }
    const bridge = window.__SLASH_DOC_FILE_PROCESSOR__;
    if (!bridge) {
      this.setStatus('Файловый сервис недоступен', true);
      return;
    }
    this.setStatus('Загрузка…');
    try {
      const result = await bridge.upload(
        await Promise.all(supported.map(async (file) => ({ name: file.name, dataUrl: await readFileAsDataUrl(file) }))),
      );
      const uploadedNames = new Set(result.uploaded.map((file) => file.name));
      this.data.files = mergeFiles(this.data.files, result.uploaded);
      this.data.results = result.files.filter(
        (file) =>
          !uploadedNames.has(file.name) && this.data.results.some((resultFile) => resultFile.name === file.name),
      );
      this.setStatus(`Загружено: ${result.uploaded.length}`);
      this.changed();
      this.refresh();
    } catch (error) {
      this.setStatus(errorMessage(error), true);
    }
  }

  private async run(): Promise<void> {
    const bridge = window.__SLASH_DOC_FILE_PROCESSOR__;
    if (!bridge) {
      this.setStatus('Файловый сервис недоступен', true);
      return;
    }
    this.data.script = this.scriptInput?.value ?? this.data.script;
    this.setStatus('Выполнение…');
    try {
      const result = await bridge.run(
        this.data.script,
        this.data.files.map((file) => file.name),
      );
      this.data.results = result.results;
      this.data.stdout = result.stdout;
      this.data.stderr = result.stderr;
      this.data.lastRun = Date.now();
      this.setStatus('Готово');
      this.changed();
      this.refresh();
    } catch (error) {
      this.data.stderr = errorMessage(error);
      this.setStatus('Ошибка выполнения', true);
      this.changed();
      this.refresh();
    }
  }

  private refresh(): void {
    this.updateHighlight();
    this.renderFiles(this.fileList, this.data.files, false);
    this.renderFiles(this.resultList, this.data.results, true);
    if (this.consoleOutput) {
      this.consoleOutput.textContent =
        [this.data.stdout, this.data.stderr].filter(Boolean).join('\n') || 'Вывод появится после выполнения.';
    }
  }

  private updateHighlight(): void {
    if (!this.scriptHighlight) return;
    const source = this.scriptInput?.value ?? this.data.script;
    this.scriptHighlight.innerHTML = `${highlightJavaScript(source)}${source.endsWith('\n') ? ' ' : ''}`;
    this.syncHighlightScroll();
  }

  private syncHighlightScroll(): void {
    if (!this.scriptInput || !this.scriptHighlight) return;
    this.scriptHighlight.scrollTop = this.scriptInput.scrollTop;
    this.scriptHighlight.scrollLeft = this.scriptInput.scrollLeft;
  }

  private renderFiles(container: HTMLElement | undefined, files: ProcessorFileInfo[], downloadable: boolean): void {
    if (!container) return;
    container.replaceChildren();
    if (files.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'fp-empty';
      empty.textContent = downloadable ? 'Результатов пока нет' : 'Файлы не загружены';
      container.append(empty);
      return;
    }
    for (const file of files) {
      const item = document.createElement('span');
      item.className = 'fp-file';
      const name = document.createElement('span');
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'fp-size';
      size.textContent = formatSize(file.size);
      item.append(name, size);
      if (downloadable) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fp-button secondary';
        button.textContent = 'Скачать';
        button.addEventListener('click', () => void window.__SLASH_DOC_FILE_PROCESSOR__?.download(file.name));
        item.append(button);
      }
      container.append(item);
    }
  }

  private setStatus(message: string, error = false): void {
    if (this.status) {
      this.status.textContent = message;
      this.status.style.color = error ? 'var(--vscode-errorForeground)' : '';
    }
  }

  private changed(): void {
    this.wrapper?.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }
}

function normalizeFiles(value: unknown): ProcessorFileInfo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    typeof item === 'object' && item !== null && typeof (item as ProcessorFileInfo).name === 'string'
      ? [
          {
            name: (item as ProcessorFileInfo).name,
            size: Number((item as ProcessorFileInfo).size) || 0,
            modified: Number((item as ProcessorFileInfo).modified) || 0,
          },
        ]
      : [],
  );
}

function mergeFiles(current: ProcessorFileInfo[], added: ProcessorFileInfo[]): ProcessorFileInfo[] {
  const files = new Map(current.map((file) => [file.name, file]));
  for (const file of added) files.set(file.name, file);
  return [...files.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function formatSize(size: number): string {
  return size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function highlightJavaScript(code: string): string {
  const keywords = new Set([
    'as',
    'async',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
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
    'get',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'null',
    'of',
    'return',
    'set',
    'static',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'undefined',
    'var',
    'void',
    'while',
    'with',
    'yield',
  ]);
  const pattern =
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][A-Za-z0-9_$]*\b|[{}\[\](),.;:?<>+=\-*/%&|!]/g;
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    output += escapeCode(code.slice(cursor, match.index));
    const token = match[0];
    const rest = code.slice(pattern.lastIndex);
    let kind = '';
    if (token.startsWith('//') || token.startsWith('/*')) kind = 'comment';
    else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) kind = 'string';
    else if (/^\d/.test(token)) kind = 'number';
    else if (keywords.has(token)) kind = 'keyword';
    else if (/^[A-Za-z_$]/.test(token) && /^\s*:/.test(rest)) kind = 'property';
    else if (/^[{}\[\](),.;:?<>+=\-*/%&|!]$/.test(token)) kind = 'punctuation';
    output += kind ? `<span class="fp-token-${kind}">${escapeCode(token)}</span>` : escapeCode(token);
    cursor = pattern.lastIndex;
  }
  return output + escapeCode(code.slice(cursor));
}

function escapeCode(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
