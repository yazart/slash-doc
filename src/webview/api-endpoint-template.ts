import { html, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import {
  apiBodyKinds,
  apiContentTypes,
  apiMethods,
  apiParameterTypes,
  apiSchemaTypes,
  type ApiBodyKind,
  type ApiEndpointData,
  type ApiParameter,
  type ApiParameterType,
  type ApiSchemaField,
  type ApiSchemaType,
} from '../shared/api-endpoint';
import { highlightApiCode } from './api-endpoint-element-utils';

export type ApiEndpointTab = 'description' | 'preview';
export type ApiEndpointPreview = 'models' | 'fetch' | 'angular' | 'swagger' | 'html';
export type ApiEndpointSchemaSection = 'body' | 'response';

export type ApiEndpointTemplateState = {
  endpoint: ApiEndpointData;
  tab: ApiEndpointTab;
  preview: ApiEndpointPreview;
  schemaTab: ApiEndpointSchemaSection;
  generated: string;
};

export type ApiEndpointTemplateActions = {
  setTab(tab: ApiEndpointTab): void;
  setPreview(preview: ApiEndpointPreview): void;
  setSchemaTab(section: ApiEndpointSchemaSection): void;
  updateEndpoint(patch: Partial<ApiEndpointData>): void;
  updateUri(uri: string): void;
  updateParameter(id: string, patch: Partial<ApiParameter>): void;
  updatePayload(section: ApiEndpointSchemaSection, patch: Record<string, unknown>): void;
  updateField(section: ApiEndpointSchemaSection, id: string, patch: Partial<ApiSchemaField>): void;
  addField(section: ApiEndpointSchemaSection, parentId?: string): void;
  deleteField(section: ApiEndpointSchemaSection, id: string): void;
};

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

export function renderApiEndpointTemplate(
  state: ApiEndpointTemplateState,
  actions: ApiEndpointTemplateActions,
): TemplateResult {
  const payload = state.endpoint[state.schemaTab];
  return html`<div class="shell">
    <nav class="tabs">
      <button class=${state.tab === 'description' ? 'active' : ''} @click=${() => actions.setTab('description')}>
        Описание</button
      ><button class=${state.tab === 'preview' ? 'active' : ''} @click=${() => actions.setTab('preview')}>
        Предпросмотр
      </button>
    </nav>
    <div class="content">
      ${
        state.tab === 'description'
          ? html`<div class="endpoint">
                <label class="field"
                  ><span>Метод</span
                  ><select
                    .value=${state.endpoint.method}
                    @change=${(event: Event) =>
                      actions.updateEndpoint({
                        method: (event.target as HTMLSelectElement).value as ApiEndpointData['method'],
                      })}
                  >
                    ${apiMethods.map((method) => html`<option>${method}</option>`)}
                  </select></label
                ><label class="field"
                  ><span>Шаблон URI</span
                  ><input
                    class="uri"
                    .value=${state.endpoint.uri}
                    @input=${(event: Event) => actions.updateUri((event.target as HTMLInputElement).value)} /></label
                ><label class="field wide"
                  ><span>Заголовок</span
                  ><input
                    .value=${state.endpoint.title}
                    @input=${(event: Event) =>
                      actions.updateEndpoint({ title: (event.target as HTMLInputElement).value })} /></label
                ><label class="field wide"
                  ><span>Описание</span
                  ><textarea
                    .value=${state.endpoint.description}
                    @input=${(event: Event) =>
                      actions.updateEndpoint({ description: (event.target as HTMLTextAreaElement).value })}
                  ></textarea>
                </label>
              </div>
              <section class="section">
                <div class="section-head"><h4>Параметры пути и запроса</h4></div>
                ${
                  state.endpoint.parameters.length
                    ? state.endpoint.parameters.map(
                        (parameter) =>
                          html`<div class="parameter">
                            <span class="badge">${parameter.in === 'path' ? '{' : '?{'}${parameter.name}}</span
                            ><span>${parameter.in === 'path' ? 'путь' : 'запрос'}</span
                            ><select
                              .value=${parameter.type}
                              @change=${(event: Event) =>
                                actions.updateParameter(parameter.id, {
                                  type: (event.target as HTMLSelectElement).value as ApiParameterType,
                                })}
                            >
                              ${apiParameterTypes.map(
                                (type) => html`<option value=${type}>${parameterTypeLabels[type]}</option>`,
                              )}</select
                            ><label class="required"
                              ><input
                                type="checkbox"
                                .checked=${parameter.required}
                                @change=${(event: Event) =>
                                  actions.updateParameter(parameter.id, {
                                    required: (event.target as HTMLInputElement).checked,
                                  })}
                              />обязательный</label
                            ><input
                              placeholder="пример"
                              .value=${parameter.example}
                              @input=${(event: Event) =>
                                actions.updateParameter(parameter.id, {
                                  example: (event.target as HTMLInputElement).value,
                                })}
                            /><input
                              placeholder="описание"
                              .value=${parameter.description}
                              @input=${(event: Event) =>
                                actions.updateParameter(parameter.id, {
                                  description: (event.target as HTMLInputElement).value,
                                })}
                            />
                          </div>`,
                      )
                    : html`<div class="parameter"><span>В URI нет переменных</span></div>`
                }
              </section>
              <section class="section">
                <div class="schema-tabs">
                  <button
                    class=${state.schemaTab === 'body' ? 'active' : ''}
                    @click=${() => actions.setSchemaTab('body')}
                  >
                    Тело запроса</button
                  ><button
                    class=${state.schemaTab === 'response' ? 'active' : ''}
                    @click=${() => actions.setSchemaTab('response')}
                  >
                    Ответ
                  </button>
                </div>
                <div class="payload-head">
                  ${
                    state.schemaTab === 'response'
                      ? html`<label class="field"
                          ><span>Статус</span
                          ><input
                            type="number"
                            .value=${String(state.endpoint.response.status)}
                            @input=${(event: Event) =>
                              actions.updatePayload('response', {
                                status: Number((event.target as HTMLInputElement).value) || 200,
                              })}
                        /></label>`
                      : html`<span></span>`
                  }<label class="field"
                    ><span>Тип содержимого</span
                    ><select
                      .value=${payload.contentType}
                      @change=${(event: Event) =>
                        actions.updatePayload(state.schemaTab, {
                          contentType: (event.target as HTMLSelectElement).value,
                        })}
                    >
                      ${apiContentTypes.map((type) => html`<option>${type}</option>`)}
                    </select></label
                  ><label class="field"
                    ><span>Тип тела</span
                    ><select
                      .value=${payload.kind}
                      @change=${(event: Event) =>
                        actions.updatePayload(state.schemaTab, {
                          kind: (event.target as HTMLSelectElement).value as ApiBodyKind,
                        })}
                    >
                      ${apiBodyKinds
                        .filter((kind) => state.schemaTab === 'body' || kind !== 'formData')
                        .map((kind) => html`<option value=${kind}>${bodyKindLabels[kind]}</option>`)}
                    </select></label
                  >
                </div>
                ${
                  payload.kind === 'object' || payload.kind === 'formData'
                    ? html`<div class="schema">
                        ${renderApiSchemaTemplate(payload.schema, state.schemaTab, actions)}
                        <button class="add" @click=${() => actions.addField(state.schemaTab)}>＋ добавить поле</button>
                      </div>`
                    : ''
                }
              </section>`
          : html`<div class="preview-tabs">
                ${(['models', 'fetch', 'angular', 'swagger', 'html'] as ApiEndpointPreview[]).map(
                  (mode) =>
                    html`<button
                      class=${state.preview === mode ? 'active' : ''}
                      @click=${() => actions.setPreview(mode)}
                    >
                      ${previewLabel(mode)}
                    </button>`,
                )}
              </div>
              ${
                state.preview === 'html'
                  ? html`<div class="html-preview">${unsafeHTML(state.generated)}</div>`
                  : html`<pre><code>${unsafeHTML(
                      highlightApiCode(state.generated, state.preview === 'swagger' ? 'json' : 'typescript'),
                    )}</code></pre>`
              }`
      }
    </div>
  </div>`;
}

function renderApiSchemaTemplate(
  fields: ApiSchemaField[],
  section: ApiEndpointSchemaSection,
  actions: ApiEndpointTemplateActions,
  depth = 0,
): TemplateResult[] {
  return fields.map(
    (field) =>
      html`<div>
        <div class="schema-row" style=${`padding-left:${8 + depth * 15}px`}>
          <input
            .value=${field.name}
            @input=${(event: Event) =>
              actions.updateField(section, field.id, {
                name: (event.target as HTMLInputElement).value.replace(/\s+/g, '_'),
              })}
          /><select
            .value=${field.type}
            @change=${(event: Event) =>
              actions.updateField(section, field.id, {
                type: (event.target as HTMLSelectElement).value as ApiSchemaType,
              })}
          >
            ${apiSchemaTypes.map((type) => html`<option value=${type}>${schemaTypeLabels[type]}</option>`)}</select
          ><label class="required"
            ><input
              type="checkbox"
              .checked=${field.required}
              @change=${(event: Event) =>
                actions.updateField(section, field.id, {
                  required: (event.target as HTMLInputElement).checked,
                })}
            />обяз.</label
          ><input
            placeholder="описание"
            .value=${field.description}
            @input=${(event: Event) =>
              actions.updateField(section, field.id, {
                description: (event.target as HTMLInputElement).value,
              })}
          /><span class="schema-actions"
            >${
              field.type === 'object' || field.type === 'array'
                ? html`<button
                    class="icon-button"
                    title="Добавить дочернее поле"
                    @click=${() => actions.addField(section, field.id)}
                  >
                    ＋
                  </button>`
                : ''
            }<button class="icon-button" title="Удалить" @click=${() => actions.deleteField(section, field.id)}>
              ×
            </button></span
          >
        </div>
        ${field.children.length ? renderApiSchemaTemplate(field.children, section, actions, depth + 1) : ''}
      </div>`,
  );
}

function previewLabel(mode: ApiEndpointPreview): string {
  if (mode === 'models') return 'Модели TS';
  if (mode === 'fetch') return 'Запрос TS fetch';
  if (mode === 'angular') return 'Angular';
  if (mode === 'swagger') return 'Swagger';
  return 'HTML';
}
