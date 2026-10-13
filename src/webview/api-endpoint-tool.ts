import { createApiEndpointData, type ApiEndpointData } from '../shared/api-endpoint';
import type { ApiEndpointElement } from './api-endpoint-element';
import './api-endpoint-element';
import { LUCIDE_ICONS } from './lucide-icons';
import { createToolSurface, type ToolSurfaceElement } from './tool-surface';

export default class ApiEndpointTool {
  private readonly data: ApiEndpointData;
  private element?: ApiEndpointElement;
  private wrapper?: ToolSurfaceElement;
  static get toolbox() {
    return {
      title: 'Эндпоинт API',
      icon: LUCIDE_ICONS.braces,
    };
  }
  constructor({ data }: { data?: Partial<ApiEndpointData> }) {
    this.data = createApiEndpointData(data);
  }
  render() {
    this.wrapper = createToolSurface('', 'slash-api-endpoint-tool');
    this.element = document.createElement('slash-api-endpoint');
    this.element.data = this.data;
    this.element.addEventListener('api-endpoint-change', () => {
      if (!this.wrapper) return;
      this.wrapper.dataset.revision = String(Number(this.wrapper.dataset.revision ?? '0') + 1);
      this.wrapper.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
    this.wrapper.content.append(this.element);
    return this.wrapper;
  }
  save() {
    return this.element?.value ?? this.data;
  }
}
