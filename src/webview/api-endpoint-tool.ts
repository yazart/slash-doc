import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import {
  apiBodyKinds,
  apiContentTypes,
  apiMethods,
  apiParameterTypes,
  apiSchemaTypes,
  createApiEndpointData,
  createSchemaField,
  generateAngularRequest,
  generateApiHtmlPreview,
  generateNativeFetch,
  generateSwaggerSchema,
  generateTypeScriptModels,
  syncApiParameters,
  type ApiBodyKind,
  type ApiEndpointData,
  type ApiParameter,
  type ApiParameterType,
  type ApiSchemaField,
  type ApiSchemaType,
} from '../shared/api-endpoint';

type ToolArgs = { data?: Partial<ApiEndpointData> };
type Tab = 'description' | 'preview';
type Preview = 'models' | 'fetch' | 'angular' | 'swagger' | 'html';
type SchemaSection = 'body' | 'response';

const parameterTypeLabels: Record<ApiParameterType, string> = {
  string: 'Строка',
  number: 'Число',
  date: 'Дата',
};
const schemaTypeLabels: Record<ApiSchemaType, string> = {
  string: 'Строка',
  number: 'Число',
  integer: 'Целое число',
  boolean: 'Логическое значение',
  date: 'Дата',
  object: 'Объект',
  array: 'Массив',
  null: 'Пустое значение',
};
const bodyKindLabels: Record<ApiBodyKind, string> = {
  none: 'Без тела',
  string: 'Строка',
  formData: 'Данные формы',
  object: 'Объект',
};

@customElement('slash-api-endpoint')
export class ApiEndpointElement extends LitElement {
  @property({ attribute: false }) data: ApiEndpointData = createApiEndpointData();
  @state() private endpoint: ApiEndpointData = createApiEndpointData();
  @state() private tab: Tab = 'description';
  @state() private preview: Preview = 'fetch';
  @state() private schemaTab: SchemaSection = 'body';
  private initialized = false;
  static styles = css`
    :host {
      display: block;
      width: 100%;
      color: var(--vscode-editor-foreground, #ccc);
      font-family: var(--vscode-font-family, sans-serif);
    }
    * {
      box-sizing: border-box;
    }
    button,
    input,
    select,
    textarea {
      font: inherit;
    }
    .shell {
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border, #555);
      border-radius: 5px;
      background: var(--vscode-editor-background);
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--vscode-panel-border, #555);
      background: var(--vscode-editorWidget-background);
    }
    .tabs button {
      padding: 8px 14px;
      color: var(--vscode-descriptionForeground);
      border: 0;
      border-right: 1px solid var(--vscode-panel-border);
      background: transparent;
      cursor: pointer;
      font-size: 11px;
    }
    .tabs button.active {
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      box-shadow: inset 0 2px var(--vscode-focusBorder);
    }
    .content {
      padding: 12px;
    }
    .endpoint {
      display: grid;
      grid-template-columns: 105px minmax(0, 1fr);
      gap: 7px;
    }
    .field {
      display: grid;
      gap: 4px;
    }
    .field > span,
    .section-label {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      text-transform: uppercase;
    }
    input,
    select,
    textarea {
      width: 100%;
      padding: 6px;
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 2px;
      outline: 0;
      background: var(--vscode-input-background);
    }
    input:focus,
    select:focus,
    textarea:focus {
      border-color: var(--vscode-focusBorder);
    }
    textarea {
      min-height: 58px;
      resize: vertical;
    }
    .wide {
      grid-column: 1/-1;
    }
    .uri {
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .section {
      margin-top: 14px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 9px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .section-head h4 {
      margin: 0;
      font-size: 11px;
    }
    .parameter {
      display: grid;
      grid-template-columns: 110px 70px 90px 65px minmax(100px, 1fr) minmax(100px, 1fr);
      gap: 5px;
      align-items: center;
      padding: 6px 8px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 65%, transparent);
      font-size: 11px;
    }
    .parameter:last-child {
      border-bottom: 0;
    }
    .badge {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-symbolIcon-variableForeground, #75beff);
    }
    .required {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--vscode-descriptionForeground);
    }
    .required input {
      width: auto;
    }
    .payload-head {
      display: grid;
      grid-template-columns: 1fr 130px 90px;
      gap: 7px;
      padding: 8px;
    }
    .schema-tabs {
      display: flex;
      border-top: 1px solid var(--vscode-panel-border);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .schema-tabs button {
      padding: 6px 10px;
      color: var(--vscode-descriptionForeground);
      border: 0;
      border-right: 1px solid var(--vscode-panel-border);
      background: transparent;
      cursor: pointer;
      font-size: 10px;
    }
    .schema-tabs button.active {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }
    .schema {
      padding: 5px 0;
    }
    .schema-row {
      display: grid;
      grid-template-columns: minmax(90px, 150px) 90px 58px minmax(100px, 1fr) 52px;
      gap: 5px;
      align-items: center;
      padding: 4px 8px;
      font-size: 10px;
    }
    .schema-row:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .schema-actions {
      display: flex;
      gap: 2px;
    }
    .icon-button {
      padding: 3px 5px;
      color: var(--vscode-descriptionForeground);
      border: 0;
      background: transparent;
      cursor: pointer;
    }
    .icon-button:hover {
      color: var(--vscode-foreground);
    }
    .add {
      margin: 4px 8px 8px;
      padding: 4px 8px;
      color: var(--vscode-textLink-foreground);
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: 10px;
    }
    .preview-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }
    .preview-tabs button {
      padding: 5px 9px;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-editorWidget-background);
      cursor: pointer;
      font-size: 10px;
    }
    .preview-tabs button.active {
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
      background: var(--vscode-button-background);
    }
    pre {
      max-height: 560px;
      overflow: auto;
      margin: 0;
      padding: 12px;
      color: var(--vscode-editor-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-textCodeBlock-background);
      font: 11px/1.5 var(--vscode-editor-font-family, monospace);
      white-space: pre;
    }
    .syntax-keyword {
      color: var(--vscode-debugTokenExpression-name, #c586c0);
    }
    .syntax-string {
      color: var(--vscode-debugTokenExpression-string, #ce9178);
    }
    .syntax-number {
      color: var(--vscode-debugTokenExpression-number, #b5cea8);
    }
    .syntax-comment {
      color: var(--vscode-descriptionForeground, #6a9955);
      font-style: italic;
    }
    .syntax-property {
      color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe);
    }
    .syntax-punctuation {
      color: var(--vscode-symbolIcon-operatorForeground, #d4d4d4);
    }
    .html-preview {
      padding: 14px;
      color: #202124;
      border-radius: 3px;
      background: #fff;
    }
    .html-preview .api-endpoint-doc header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .html-preview .api-method {
      padding: 4px 7px;
      color: white;
      border-radius: 3px;
      background: #3979c6;
      font: bold 11px monospace;
    }
    .html-preview .api-method-post {
      background: #2e9b57;
    }
    .html-preview .api-method-delete {
      background: #c43b3b;
    }
    .html-preview .api-uri {
      font-size: 13px;
    }
    .html-preview h2 {
      font-size: 18px;
    }
    .html-preview h3 {
      margin-top: 16px;
      font-size: 14px;
    }
    .html-preview table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .html-preview th,
    .html-preview td {
      padding: 5px;
      border: 1px solid #ccc;
      text-align: left;
    }
    @media (max-width: 760px) {
      .parameter {
        grid-template-columns: 1fr 80px 70px;
      }
      .parameter input:nth-last-child(-n + 2) {
        grid-column: span 3;
      }
      .endpoint {
        grid-template-columns: 90px 1fr;
      }
      .schema-row {
        grid-template-columns: 1fr 80px 50px;
      }
      .schema-row input:nth-of-type(2),
      .schema-actions {
        grid-column: span 1;
      }
    }
  `;
  protected willUpdate(changes: Map<PropertyKey, unknown>) {
    if (changes.has('data') && !this.initialized) {
      this.endpoint = createApiEndpointData(this.data);
      this.initialized = true;
    }
  }
  get value() {
    return createApiEndpointData(this.endpoint);
  }
  private emit() {
    this.dispatchEvent(new CustomEvent('api-endpoint-change', { detail: this.value, bubbles: true, composed: true }));
  }
  private updateEndpoint(patch: Partial<ApiEndpointData>) {
    this.endpoint = createApiEndpointData({ ...this.endpoint, ...patch });
    this.emit();
  }
  private updateUri(uri: string) {
    this.endpoint = { ...this.endpoint, uri, parameters: syncApiParameters(uri, this.endpoint.parameters) };
    this.emit();
  }
  private updateParameter(id: string, patch: Partial<ApiParameter>) {
    this.endpoint = {
      ...this.endpoint,
      parameters: this.endpoint.parameters.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    };
    this.emit();
  }
  private updatePayload(section: SchemaSection, patch: Record<string, unknown>) {
    this.endpoint = createApiEndpointData({ ...this.endpoint, [section]: { ...this.endpoint[section], ...patch } });
    this.emit();
  }
  private updateField(section: SchemaSection, id: string, patch: Partial<ApiSchemaField>) {
    const schema = mapFields(this.endpoint[section].schema, id, (field) => {
      const next = { ...field, ...patch };
      if (next.type !== 'object' && next.type !== 'array') next.children = [];
      if (next.type === 'array' && next.children.length > 1) next.children = [next.children[0]];
      return next;
    });
    this.updatePayload(section, { schema });
  }
  private addField(section: SchemaSection, parentId?: string) {
    const field = createSchemaField(parentId ? 'item' : 'field');
    const schema = parentId
      ? mapFields(this.endpoint[section].schema, parentId, (parent) => ({
          ...parent,
          children: parent.type === 'array' ? [field] : [...parent.children, field],
        }))
      : [...this.endpoint[section].schema, field];
    this.updatePayload(section, { schema });
  }
  private deleteField(section: SchemaSection, id: string) {
    this.updatePayload(section, { schema: removeField(this.endpoint[section].schema, id) });
  }
  private renderSchema(fields: ApiSchemaField[], section: SchemaSection, depth = 0): unknown {
    return fields.map(
      (field) =>
        html`<div>
          <div class="schema-row" style=${`padding-left:${8 + depth * 15}px`}>
            <input
              .value=${field.name}
              @input=${(event: Event) => this.updateField(section, field.id, { name: (event.target as HTMLInputElement).value.replace(/\s+/g, '_') })}
            /><select
              .value=${field.type}
              @change=${(event: Event) => this.updateField(section, field.id, { type: (event.target as HTMLSelectElement).value as ApiSchemaType })}
            >
              ${apiSchemaTypes.map((type) => html`<option value=${type}>${schemaTypeLabels[type]}</option>`)}</select
            ><label class="required"
              ><input
                type="checkbox"
                .checked=${field.required}
                @change=${(event: Event) => this.updateField(section, field.id, { required: (event.target as HTMLInputElement).checked })}
              />обяз.</label
            ><input
              placeholder="описание"
              .value=${field.description}
              @input=${(event: Event) => this.updateField(section, field.id, { description: (event.target as HTMLInputElement).value })}
            /><span class="schema-actions"
              >${field.type === 'object' || field.type === 'array' ? html`<button class="icon-button" title="Добавить дочернее поле" @click=${() => this.addField(section, field.id)}>＋</button>` : ''}<button
                class="icon-button"
                title="Удалить"
                @click=${() => this.deleteField(section, field.id)}
              >
                ×
              </button></span
            >
          </div>
          ${field.children.length ? this.renderSchema(field.children, section, depth + 1) : ''}
        </div>`,
    );
  }
  private generated() {
    const models = generateTypeScriptModels(this.endpoint);
    if (this.preview === 'models') return models;
    if (this.preview === 'angular') return `${models}\n\n${generateAngularRequest(this.endpoint)}`;
    if (this.preview === 'swagger') return generateSwaggerSchema(this.endpoint);
    if (this.preview === 'html') return generateApiHtmlPreview(this.endpoint);
    return `${models}\n\n${generateNativeFetch(this.endpoint)}`;
  }
  render() {
    const payload = this.endpoint[this.schemaTab];
    return html`<div class="shell">
      <nav class="tabs">
        <button
          class=${this.tab === 'description' ? 'active' : ''}
          @click=${() => {
            this.tab = 'description';
          }}
        >
          Описание</button
        ><button
          class=${this.tab === 'preview' ? 'active' : ''}
          @click=${() => {
            this.tab = 'preview';
          }}
        >
          Предпросмотр
        </button>
      </nav>
      <div class="content">
        ${
          this.tab === 'description'
            ? html`<div class="endpoint">
                  <label class="field"
                    ><span>Метод</span
                    ><select
                      .value=${this.endpoint.method}
                      @change=${(event: Event) => this.updateEndpoint({ method: (event.target as HTMLSelectElement).value as ApiEndpointData['method'] })}
                    >
                      ${apiMethods.map((method) => html`<option>${method}</option>`)}
                    </select></label
                  ><label class="field"
                    ><span>Шаблон URI</span
                    ><input
                      class="uri"
                      .value=${this.endpoint.uri}
                      @input=${(event: Event) => this.updateUri((event.target as HTMLInputElement).value)} /></label
                  ><label class="field wide"
                    ><span>Заголовок</span
                    ><input
                      .value=${this.endpoint.title}
                      @input=${(event: Event) => this.updateEndpoint({ title: (event.target as HTMLInputElement).value })} /></label
                  ><label class="field wide"
                    ><span>Описание</span
                    ><textarea
                      .value=${this.endpoint.description}
                      @input=${(event: Event) => this.updateEndpoint({ description: (event.target as HTMLTextAreaElement).value })}
                    ></textarea>
                  </label>
                </div>
                <section class="section">
                  <div class="section-head"><h4>Параметры пути и запроса</h4></div>
                  ${
                    this.endpoint.parameters.length
                      ? this.endpoint.parameters.map(
                          (parameter) =>
                            html`<div class="parameter">
                              <span class="badge">${parameter.in === 'path' ? '{' : '?{'}${parameter.name}}</span
                              ><span>${parameter.in === 'path' ? 'путь' : 'запрос'}</span
                              ><select
                                .value=${parameter.type}
                                @change=${(event: Event) => this.updateParameter(parameter.id, { type: (event.target as HTMLSelectElement).value as ApiParameterType })}
                              >
                                ${apiParameterTypes.map((type) => html`<option value=${type}>${parameterTypeLabels[type]}</option>`)}</select
                              ><label class="required"
                                ><input
                                  type="checkbox"
                                  .checked=${parameter.required}
                                  @change=${(event: Event) => this.updateParameter(parameter.id, { required: (event.target as HTMLInputElement).checked })}
                                />обязательный</label
                              ><input
                                placeholder="пример"
                                .value=${parameter.example}
                                @input=${(event: Event) => this.updateParameter(parameter.id, { example: (event.target as HTMLInputElement).value })}
                              /><input
                                placeholder="описание"
                                .value=${parameter.description}
                                @input=${(event: Event) => this.updateParameter(parameter.id, { description: (event.target as HTMLInputElement).value })}
                              />
                            </div>`,
                        )
                      : html`<div class="parameter"><span>В URI нет переменных</span></div>`
                  }
                </section>
                <section class="section">
                  <div class="schema-tabs">
                    <button
                      class=${this.schemaTab === 'body' ? 'active' : ''}
                      @click=${() => {
                        this.schemaTab = 'body';
                      }}
                    >
                      Тело запроса</button
                    ><button
                      class=${this.schemaTab === 'response' ? 'active' : ''}
                      @click=${() => {
                        this.schemaTab = 'response';
                      }}
                    >
                      Ответ
                    </button>
                  </div>
                  <div class="payload-head">
                    ${this.schemaTab === 'response' ? html`<label class="field"><span>Статус</span><input type="number" .value=${String(this.endpoint.response.status)} @input=${(event: Event) => this.updatePayload('response', { status: Number((event.target as HTMLInputElement).value) || 200 })} /></label>` : html`<span></span>`}<label
                      class="field"
                      ><span>Тип содержимого</span
                      ><select
                        .value=${payload.contentType}
                        @change=${(event: Event) => this.updatePayload(this.schemaTab, { contentType: (event.target as HTMLSelectElement).value })}
                      >
                        ${apiContentTypes.map((type) => html`<option>${type}</option>`)}
                      </select></label
                    ><label class="field"
                      ><span>Тип тела</span
                      ><select
                        .value=${payload.kind}
                        @change=${(event: Event) => this.updatePayload(this.schemaTab, { kind: (event.target as HTMLSelectElement).value as ApiBodyKind })}
                      >
                        ${apiBodyKinds.filter((kind) => this.schemaTab === 'body' || kind !== 'formData').map((kind) => html`<option value=${kind}>${bodyKindLabels[kind]}</option>`)}
                      </select></label
                    >
                  </div>
                  ${payload.kind === 'object' || payload.kind === 'formData' ? html`<div class="schema">${this.renderSchema(payload.schema, this.schemaTab)}<button class="add" @click=${() => this.addField(this.schemaTab)}>＋ добавить поле</button></div>` : ''}
                </section>`
            : html`<div class="preview-tabs">
                  ${(['models', 'fetch', 'angular', 'swagger', 'html'] as Preview[]).map(
                    (mode) =>
                      html`<button
                        class=${this.preview === mode ? 'active' : ''}
                        @click=${() => {
                          this.preview = mode;
                        }}
                      >
                        ${mode === 'models' ? 'Модели TS' : mode === 'fetch' ? 'Запрос TS fetch' : mode === 'angular' ? 'Angular' : mode === 'swagger' ? 'Swagger' : 'HTML'}
                      </button>`,
                  )}
                </div>
                ${this.preview === 'html' ? html`<div class="html-preview">${unsafeHTML(this.generated())}</div>` : html`<pre><code>${unsafeHTML(highlightCode(this.generated(), this.preview === 'swagger' ? 'json' : 'typescript'))}</code></pre>`}`
        }
      </div>
    </div>`;
  }
}

export default class ApiEndpointTool {
  private readonly data: ApiEndpointData;
  private element?: ApiEndpointElement;
  private wrapper?: HTMLDivElement;
  static get toolbox() {
    return {
      title: 'Эндпоинт API',
      icon: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M5 3 1.5 8.5 5 14M12 3l3.5 5.5L12 14M10 1 7 16" stroke="currentColor" stroke-linecap="round"/></svg>',
    };
  }
  constructor({ data }: ToolArgs) {
    this.data = createApiEndpointData(data);
  }
  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-api-endpoint-tool';
    this.element = document.createElement('slash-api-endpoint');
    this.element.data = this.data;
    this.element.addEventListener('api-endpoint-change', () => {
      if (!this.wrapper) return;
      this.wrapper.dataset.revision = String(Number(this.wrapper.dataset.revision ?? '0') + 1);
      this.wrapper.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
    this.wrapper.append(this.element);
    return this.wrapper;
  }
  save() {
    return this.element?.value ?? this.data;
  }
}
function mapFields(
  fields: ApiSchemaField[],
  id: string,
  update: (field: ApiSchemaField) => ApiSchemaField,
): ApiSchemaField[] {
  return fields.map((field) =>
    field.id === id ? update(field) : { ...field, children: mapFields(field.children, id, update) },
  );
}
function removeField(fields: ApiSchemaField[], id: string): ApiSchemaField[] {
  return fields
    .filter((field) => field.id !== id)
    .map((field) => ({ ...field, children: removeField(field.children, id) }));
}
function highlightCode(code: string, language: 'typescript' | 'json'): string {
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
  let output = '',
    cursor = 0,
    match: RegExpExecArray | null;
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
declare global {
  interface HTMLElementTagNameMap {
    'slash-api-endpoint': ApiEndpointElement;
  }
}
