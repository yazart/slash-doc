import type {
  ApiService,
  CustomEditorAddon,
  SettingsVariable,
  SlashDocSettings
} from './types';
import { escapeAttribute } from './utils';

export function renderSettingsPanel(settings: SlashDocSettings): string {
  return `<div class="panel panel-settings">
    <header class="settings-header">
      <sl-button id="back-to-menu" size="small" variant="default">Назад</sl-button>
      <h2 class="settings-title">Настройки</h2>
    </header>
    <section class="settings-panel" aria-label="Настройки">
      <div class="settings-group">
        <div class="settings-group-title">Свои Editor.js аддоны</div>
        <div id="custom-addons-list" class="settings-list">${settings.customEditorAddons.map(renderCustomAddonRow).join('')}</div>
        <div class="service-actions"><sl-button id="add-addon" size="small" variant="default">Добавить модуль</sl-button></div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">HTTP API сервисы</div>
        <div class="settings-row api-settings-row">
          <input class="settings-input" id="api-prefix" value="${escapeAttribute(settings.apiPrefix)}" placeholder="/api">
          <input class="settings-input" id="api-port" value="${escapeAttribute(String(settings.apiPort))}" inputmode="numeric" placeholder="4317">
        </div>
        <div id="services-list" class="settings-list">${settings.apiServices.map(renderServiceRow).join('')}</div>
        <div class="service-actions">
          <sl-button id="add-service" size="small" variant="default">Добавить route</sl-button>
          <sl-button id="reload-api-services" size="small" variant="primary">Перезагрузить API</sl-button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Переменные сервисов</div>
        <div id="variables-list" class="settings-list">${settings.variables.map(renderVariableRow).join('')}</div>
        <sl-button id="add-variable" size="small" variant="default">Добавить переменную</sl-button>
      </div>
    </section>
  </div>`;
}

function renderServiceRow(service: ApiService): string {
  return `<div class="settings-row service-row" data-service-id="${escapeAttribute(service.id)}">
    <input class="settings-input" data-service-field="name" value="${escapeAttribute(service.name)}" placeholder="name">
    <input class="settings-input" data-service-field="file" value="${escapeAttribute(service.file)}" placeholder="route.mjs">
    <button class="settings-open-button" type="button" data-open-service="${escapeAttribute(service.id)}">Открыть</button>
  </div>`;
}

function renderCustomAddonRow(addon: CustomEditorAddon): string {
  return `<div class="settings-row custom-addon-row" data-custom-addon-id="${escapeAttribute(addon.id)}">
    <input class="settings-input" data-custom-addon-field="name" value="${escapeAttribute(addon.name)}" placeholder="name">
    <input class="settings-input" data-custom-addon-field="toolName" value="${escapeAttribute(addon.toolName)}" placeholder="toolName">
    <input class="settings-input" data-custom-addon-field="file" value="${escapeAttribute(addon.file)}" placeholder="tool.mjs">
    <sl-switch data-custom-addon-enabled="${escapeAttribute(addon.id)}" ${addon.enabled ? 'checked' : ''}></sl-switch>
    <button class="settings-open-button" type="button" data-open-addon="${escapeAttribute(addon.id)}">Открыть</button>
  </div>`;
}

function renderVariableRow(variable: SettingsVariable): string {
  return `<div class="settings-row variable-row">
    <input class="settings-input" data-variable-field="key" value="${escapeAttribute(variable.key)}" placeholder="key">
    <input class="settings-input" data-variable-field="value" value="${escapeAttribute(variable.value)}" placeholder="value">
  </div>`;
}
