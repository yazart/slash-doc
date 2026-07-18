import { LitElement, html, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { IMAGE_ANNOTATION_STYLES } from './image-annotation-styles';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderSafeMarkdown } from '../shared/markdown';

type AnnotationImage = { dataUrl: string; width: number; height: number; name: string };
export type ImageRegion = {
  id: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  zIndex: number;
};
export type ImageAnnotationData = { version: 1; image: AnnotationImage | null; annotations: ImageRegion[] };
type Point = { x: number; y: number };

@customElement('slash-image-annotation')
export class ImageAnnotationElement extends LitElement {
  @property({ attribute: false }) data: ImageAnnotationData = normalizeData();
  @state() private image: AnnotationImage | null = null;
  @state() private annotations: ImageRegion[] = [];
  @state() private drawing: { start: Point; current: Point } | null = null;
  @state() private editingId: string | null = null;
  @state() private draftDescription = '';
  @state() private isDraggingFile = false;
  private initialized = false;

  static styles = IMAGE_ANNOTATION_STYLES;

  protected willUpdate(changes: Map<PropertyKey, unknown>) {
    if (changes.has('data') && !this.initialized) {
      const data = normalizeData(this.data);
      this.image = data.image;
      this.annotations = data.annotations;
      this.initialized = true;
    }
  }
  connectedCallback() {
    super.connectedCallback();
    this.tabIndex = 0;
    this.addEventListener('paste', this.onPaste as EventListener);
  }
  disconnectedCallback() {
    this.removeEventListener('paste', this.onPaste as EventListener);
    super.disconnectedCallback();
  }
  get value(): ImageAnnotationData {
    return {
      version: 1,
      image: this.image ? { ...this.image } : null,
      annotations: this.annotations.map((item) => ({ ...item })),
    };
  }
  private emitChange() {
    this.dispatchEvent(new CustomEvent('annotation-change', { detail: this.value, bubbles: true, composed: true }));
  }
  private chooseFile() {
    this.renderRoot.querySelector<HTMLInputElement>('input[type=file]')?.click();
  }
  private async loadFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await readFile(file);
    const dimensions = await readDimensions(dataUrl);
    this.image = { dataUrl, width: dimensions.width, height: dimensions.height, name: file.name || 'pasted-image' };
    this.annotations = [];
    this.editingId = null;
    this.emitChange();
    this.focus();
  }
  private dropFile(event: DragEvent) {
    event.preventDefault();
    this.isDraggingFile = false;
    const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith('image/'));
    if (file) void this.loadFile(file);
  }
  private onPaste = (event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      void this.loadFile(file);
    }
  };
  private point(event: PointerEvent): Point {
    const rect = this.renderRoot.querySelector('.overlay')!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }
  private startDraw(event: PointerEvent) {
    if ((event.target as Element).classList.contains('region')) return;
    event.preventDefault();
    this.focus();
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
    const point = this.point(event);
    this.drawing = { start: point, current: point };
    this.editingId = null;
  }
  private moveDraw(event: PointerEvent) {
    if (this.drawing) this.drawing = { ...this.drawing, current: this.point(event) };
  }
  private finishDraw(event: PointerEvent) {
    if (!this.drawing) return;
    const current = this.point(event);
    const x = Math.min(this.drawing.start.x, current.x),
      y = Math.min(this.drawing.start.y, current.y),
      width = Math.abs(current.x - this.drawing.start.x),
      height = Math.abs(current.y - this.drawing.start.y);
    this.drawing = null;
    if (width < 0.01 || height < 0.01) return;
    const region: ImageRegion = {
      id: `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      number: this.annotations.length + 1,
      x,
      y,
      width,
      height,
      description: '',
      zIndex: Math.max(-1, ...this.annotations.map((item) => item.zIndex)) + 1,
    };
    this.annotations = [...this.annotations, region];
    this.editingId = region.id;
    this.draftDescription = '';
    this.emitChange();
  }
  private openRegion(event: PointerEvent, region: ImageRegion) {
    event.stopPropagation();
    this.editingId = region.id;
    this.draftDescription = region.description;
  }
  private saveDescription() {
    if (!this.editingId) return;
    this.annotations = this.annotations.map((item) =>
      item.id === this.editingId ? { ...item, description: this.draftDescription } : item,
    );
    this.editingId = null;
    this.emitChange();
  }
  private deleteRegion() {
    if (!this.editingId) return;
    this.annotations = this.annotations
      .filter((item) => item.id !== this.editingId)
      .map((item, index) => ({ ...item, number: index + 1 }));
    this.editingId = null;
    this.emitChange();
  }
  private sendRegionToBack() {
    if (!this.editingId) return;
    const selected = this.annotations.find((item) => item.id === this.editingId);
    if (!selected) return;
    this.annotations = [selected, ...this.annotations.filter((item) => item.id !== selected.id)].map((item, index) => ({
      ...item,
      number: index + 1,
      zIndex: index,
    }));
    this.emitChange();
  }
  private draftRect() {
    if (!this.drawing) return null;
    return {
      x: Math.min(this.drawing.start.x, this.drawing.current.x),
      y: Math.min(this.drawing.start.y, this.drawing.current.y),
      width: Math.abs(this.drawing.current.x - this.drawing.start.x),
      height: Math.abs(this.drawing.current.y - this.drawing.start.y),
    };
  }
  render() {
    const draft = this.draftRect();
    return html`<input
        type="file"
        accept="image/*"
        hidden
        @change=${(event: Event) => {
          const input = event.target as HTMLInputElement;
          const file = input.files?.[0];
          if (file) void this.loadFile(file);
          input.value = '';
        }}
      />${
        !this.image
          ? html`<div
              class="empty ${this.isDraggingFile ? 'dragging' : ''}"
              @dragover=${(event: DragEvent) => {
                event.preventDefault();
                this.isDraggingFile = true;
              }}
              @dragleave=${() => {
                this.isDraggingFile = false;
              }}
              @drop=${this.dropFile}
              @click=${() => this.focus()}
            >
              <div>
                <div class="empty-icon">▧</div>
                <h3>Аннотация изображения</h3>
                <p>Перетащите изображение сюда, вставьте его из буфера<br />или выберите файл.</p>
                <button
                  class="button"
                  @click=${(event: Event) => {
                    event.stopPropagation();
                    this.chooseFile();
                  }}
                >
                  Выбрать изображение
                </button>
              </div>
            </div>`
          : html`<div class="editor" @dragover=${(event: DragEvent) => event.preventDefault()} @drop=${this.dropFile}>
              <div class="toolbar">
                <p>
                  Проведите по изображению, чтобы создать прямоугольную аннотацию. Нажмите на область для
                  редактирования.
                </p>
                <button class="replace" @click=${this.chooseFile}>Заменить изображение</button>
              </div>
              <div class="frame">
                <img src=${this.image.dataUrl} alt=${this.image.name} /><svg
                  class="overlay"
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  @pointerdown=${this.startDraw}
                  @pointermove=${this.moveDraw}
                  @pointerup=${this.finishDraw}
                >
                  ${[...this.annotations].sort((left, right) => left.zIndex - right.zIndex).map((region) => svg`<rect class="region ${region.id === this.editingId ? 'active' : ''}" x=${region.x * 1000} y=${region.y * 1000} width=${region.width * 1000} height=${region.height * 1000} @pointerdown=${(event: PointerEvent) => this.openRegion(event, region)}/>`)}${draft ? svg`<rect class="draft" x=${draft.x * 1000} y=${draft.y * 1000} width=${draft.width * 1000} height=${draft.height * 1000}/>` : ''}</svg
                >${this.annotations.map(
                  (region) =>
                    html`<span class="region-number-bg" style=${`left:${region.x * 100}%;top:${region.y * 100}%`}
                      >${region.number}</span
                    >`,
                )}${
                  this.editingId
                    ? html`<div class="popup">
                        <h4 class="popup-title">
                          Аннотация ${this.annotations.find((item) => item.id === this.editingId)?.number}
                        </h4>
                        <textarea
                          placeholder="Описание (поддерживается Markdown)"
                          .value=${this.draftDescription}
                          @input=${(event: Event) => {
                            this.draftDescription = (event.target as HTMLTextAreaElement).value;
                          }}
                        ></textarea>
                        <div class="popup-actions">
                          <button class="send-back" @click=${this.sendRegionToBack}>На задний план</button
                          ><button class="delete" @click=${this.deleteRegion}>Удалить</button
                          ><button class="button" @click=${this.saveDescription}>Сохранить</button>
                        </div>
                      </div>`
                    : ''
                }
              </div>
              ${
                this.annotations.length
                  ? html`<table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Описание</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.annotations.map(
                          (region) =>
                            html`<tr
                              @click=${() => {
                                this.editingId = region.id;
                                this.draftDescription = region.description;
                              }}
                            >
                              <td>${region.number}</td>
                              <td class="description">${unsafeHTML(renderSafeMarkdown(region.description || '—'))}</td>
                            </tr>`,
                        )}
                      </tbody>
                    </table>`
                  : ''
              }
            </div>`
      }`;
  }
}

export function normalizeData(data?: Partial<ImageAnnotationData>): ImageAnnotationData {
  const imageValue = data?.image;
  const image =
    imageValue && typeof imageValue.dataUrl === 'string' && imageValue.dataUrl.startsWith('data:image/')
      ? {
          dataUrl: imageValue.dataUrl,
          width: finite(imageValue.width, 1),
          height: finite(imageValue.height, 1),
          name: typeof imageValue.name === 'string' ? imageValue.name : 'image',
        }
      : null;
  const annotationValues = data?.annotations;
  const annotations = Array.isArray(annotationValues)
    ? annotationValues.filter(isRegion).map((item, index) => ({
        ...item,
        number: index + 1,
        x: clamp(item.x),
        y: clamp(item.y),
        width: clamp(item.width),
        height: clamp(item.height),
        zIndex: finite(item.zIndex, index),
      }))
    : [];
  return { version: 1, image, annotations };
}
function isRegion(value: unknown): value is ImageRegion {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ImageRegion>;
  return (
    typeof item.id === 'string' &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.y) &&
    Number.isFinite(item.width) &&
    Number.isFinite(item.height) &&
    typeof item.description === 'string'
  );
}
function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function readDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    image.src = url;
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-image-annotation': ImageAnnotationElement;
  }
}
