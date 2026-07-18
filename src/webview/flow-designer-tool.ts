import { LUCIDE_ICONS } from './lucide-icons';
import { FlowDesignerElement, createFlowDesignerData } from './flow-designer-element';
import type { FlowDesignerData } from './flow-designer-element';

export default class FlowDesignerTool {
  private readonly data: FlowDesignerData;
  private element?: FlowDesignerElement;
  private wrapper?: HTMLDivElement;

  static get toolbox() {
    return {
      title: 'Конструктор процессов',
      icon: LUCIDE_ICONS.workflow,
    };
  }

  constructor({ data }: { data?: Partial<FlowDesignerData> }) {
    this.data = createFlowDesignerData(data);
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-flow-designer-tool';
    this.element = document.createElement('slash-flow-designer');
    this.element.data = this.data;
    this.element.addEventListener('workflow-change', () => {
      if (!this.wrapper) return;
      this.wrapper.dataset.revision = String(Number(this.wrapper.dataset.revision ?? '0') + 1);
      this.wrapper.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
    this.wrapper.append(this.element);
    return this.wrapper;
  }

  save(): FlowDesignerData {
    return this.element?.value ?? this.data;
  }
}
