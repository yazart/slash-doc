import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { API_ENDPOINT_STYLES } from './api-endpoint-styles';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { highlightApiCode, mapApiSchemaFields, removeApiSchemaField } from './api-endpoint-element-utils';
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
  static styles = API_ENDPOINT_STYLES;
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
    const schema = mapApiSchemaFields(this.endpoint[section].schema, id, (field) => {
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
      ? mapApiSchemaFields(this.endpoint[section].schema, parentId, (parent) => ({
          ...parent,
          children: parent.type === 'array' ? [field] : [...parent.children, field],
        }))
      : [...this.endpoint[section].schema, field];
    this.updatePayload(section, { schema });
  }
  private deleteField(section: SchemaSection, id: string) {
    this.updatePayload(section, { schema: removeApiSchemaField(this.endpoint[section].schema, id) });
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
                ${this.preview === 'html' ? html`<div class="html-preview">${unsafeHTML(this.generated())}</div>` : html`<pre><code>${unsafeHTML(highlightApiCode(this.generated(), this.preview === 'swagger' ? 'json' : 'typescript'))}</code></pre>`}`
        }
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-api-endpoint': ApiEndpointElement;
  }
}
