import { LUCIDE_ICONS } from './lucide-icons';
import { ImageAnnotationElement, normalizeData } from './image-annotation-element';
import type { ImageAnnotationData } from './image-annotation-element';
import { createToolSurface, type ToolSurfaceElement } from './tool-surface';

export default class ImageAnnotationTool {
  private readonly data: ImageAnnotationData;
  private element?: ImageAnnotationElement;
  private wrapper?: ToolSurfaceElement;
  static get toolbox() {
    return {
      title: 'Аннотация изображения',
      icon: LUCIDE_ICONS.scanLine,
    };
  }
  constructor({ data }: { data?: Partial<ImageAnnotationData> }) {
    this.data = normalizeData(data);
  }
  render() {
    this.wrapper = createToolSurface('', 'slash-image-annotation-tool');
    this.element = document.createElement('slash-image-annotation');
    this.element.data = this.data;
    this.element.addEventListener('annotation-change', () => {
      if (!this.wrapper) return;
      this.wrapper.dataset.revision = String(Number(this.wrapper.dataset.revision ?? '0') + 1);
      this.wrapper.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
    this.wrapper.content.append(this.element);
    return this.wrapper;
  }
  save(): ImageAnnotationData {
    return this.element?.value ?? this.data;
  }
}
