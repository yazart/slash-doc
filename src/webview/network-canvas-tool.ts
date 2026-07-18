import { LUCIDE_ICONS } from './lucide-icons';
import { NetworkCanvasElement, createNetworkData } from './network-canvas-element';
import type { NetworkCanvasData } from './network-canvas-element';

export default class NetworkCanvasTool {
  private readonly data: NetworkCanvasData;
  private element?: NetworkCanvasElement;
  private wrapper?: HTMLDivElement;
  static get toolbox() {
    return {
      title: 'Сетевая схема',
      icon: LUCIDE_ICONS.network,
    };
  }
  constructor({ data }: { data?: Partial<NetworkCanvasData> }) {
    this.data = createNetworkData(data);
  }
  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-network-canvas-tool';
    this.element = document.createElement('slash-network-canvas');
    this.element.data = this.data;
    this.element.addEventListener('network-change', () => {
      if (!this.wrapper) return;
      this.wrapper.dataset.revision = String(Number(this.wrapper.dataset.revision ?? '0') + 1);
      this.wrapper.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
    this.wrapper.append(this.element);
    return this.wrapper;
  }
  save(): NetworkCanvasData {
    return this.element?.value ?? this.data;
  }
}
