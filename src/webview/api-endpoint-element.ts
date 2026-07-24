import { LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import apiEndpointStyles from './api-endpoint-styles.shadow.css?raw';
import { mapApiSchemaFields, removeApiSchemaField } from './api-endpoint-element-utils';
import {
  renderApiEndpointTemplate,
  type ApiEndpointPreview,
  type ApiEndpointSchemaSection,
  type ApiEndpointTab,
} from './api-endpoint-template';
import {
  createApiEndpointData,
  createSchemaField,
  generateAngularRequest,
  generateApiHtmlPreview,
  generateNativeFetch,
  generateSwaggerSchema,
  generateTypeScriptModels,
  syncApiParameters,
  type ApiEndpointData,
  type ApiParameter,
  type ApiSchemaField,
} from '../shared/api-endpoint';

@customElement('slash-api-endpoint')
export class ApiEndpointElement extends LitElement {
  @property({ attribute: false }) data: ApiEndpointData = createApiEndpointData();
  @state() private endpoint: ApiEndpointData = createApiEndpointData();
  @state() private tab: ApiEndpointTab = 'description';
  @state() private preview: ApiEndpointPreview = 'fetch';
  @state() private schemaTab: ApiEndpointSchemaSection = 'body';
  private initialized = false;
  static styles = unsafeCSS(apiEndpointStyles);
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
  private updatePayload(section: ApiEndpointSchemaSection, patch: Record<string, unknown>) {
    this.endpoint = createApiEndpointData({ ...this.endpoint, [section]: { ...this.endpoint[section], ...patch } });
    this.emit();
  }
  private updateField(section: ApiEndpointSchemaSection, id: string, patch: Partial<ApiSchemaField>) {
    const schema = mapApiSchemaFields(this.endpoint[section].schema, id, (field) => {
      const next = { ...field, ...patch };
      if (next.type !== 'object' && next.type !== 'array') next.children = [];
      if (next.type === 'array' && next.children.length > 1) next.children = [next.children[0]];
      return next;
    });
    this.updatePayload(section, { schema });
  }
  private addField(section: ApiEndpointSchemaSection, parentId?: string) {
    const field = createSchemaField(parentId ? 'item' : 'field');
    const schema = parentId
      ? mapApiSchemaFields(this.endpoint[section].schema, parentId, (parent) => ({
          ...parent,
          children: parent.type === 'array' ? [field] : [...parent.children, field],
        }))
      : [...this.endpoint[section].schema, field];
    this.updatePayload(section, { schema });
  }
  private deleteField(section: ApiEndpointSchemaSection, id: string) {
    this.updatePayload(section, { schema: removeApiSchemaField(this.endpoint[section].schema, id) });
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
    return renderApiEndpointTemplate(
      {
        endpoint: this.endpoint,
        tab: this.tab,
        preview: this.preview,
        schemaTab: this.schemaTab,
        generated: this.generated(),
      },
      {
        setTab: (tab) => {
          this.tab = tab;
        },
        setPreview: (preview) => {
          this.preview = preview;
        },
        setSchemaTab: (section) => {
          this.schemaTab = section;
        },
        updateEndpoint: (patch) => this.updateEndpoint(patch),
        updateUri: (uri) => this.updateUri(uri),
        updateParameter: (id, patch) => this.updateParameter(id, patch),
        updatePayload: (section, patch) => this.updatePayload(section, patch),
        updateField: (section, id, patch) => this.updateField(section, id, patch),
        addField: (section, parentId) => this.addField(section, parentId),
        deleteField: (section, id) => this.deleteField(section, id),
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-api-endpoint': ApiEndpointElement;
  }
}
