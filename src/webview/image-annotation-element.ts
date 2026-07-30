import { LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import imageAnnotationStyles from './image-annotation-styles.shadow.css?raw';
import { renderImageAnnotationTemplate } from './image-annotation-template';
import { consumeClipboardImage, isolateEditorEvent } from './editor-event-isolation';

export type AnnotationImage = { dataUrl: string; width: number; height: number; name: string };
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
export type ImageAnnotationData = {
  version: 1;
  image: AnnotationImage | null;
  annotations: ImageRegion[];
  stretchToWidth: boolean;
};
type Point = { x: number; y: number };

@customElement('slash-image-annotation')
export class ImageAnnotationElement extends LitElement {
  @property({ attribute: false }) data: ImageAnnotationData = normalizeData();
  @state() private image: AnnotationImage | null = null;
  @state() private annotations: ImageRegion[] = [];
  @state() private stretchToWidth = true;
  @state() private drawing: { start: Point; current: Point } | null = null;
  @state() private editingId: string | null = null;
  @state() private draftDescription = '';
  @state() private isDraggingFile = false;
  private initialized = false;

  static styles = unsafeCSS(imageAnnotationStyles);

  protected willUpdate(changes: Map<PropertyKey, unknown>) {
    if (changes.has('data') && !this.initialized) {
      const data = normalizeData(this.data);
      this.image = data.image;
      this.annotations = data.annotations;
      this.stretchToWidth = data.stretchToWidth;
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
      stretchToWidth: this.stretchToWidth,
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
    isolateEditorEvent(event);
    this.isDraggingFile = false;
    const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith('image/'));
    if (file) void this.loadFile(file);
  }
  private onPaste = (event: ClipboardEvent) => {
    consumeClipboardImage(event, (file) => this.pasteImage(file));
  };
  pasteImage(file: File): void {
    void this.loadFile(file);
  }
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
    return renderImageAnnotationTemplate(
      {
        image: this.image,
        annotations: this.annotations,
        stretchToWidth: this.stretchToWidth,
        isDraggingFile: this.isDraggingFile,
        editingId: this.editingId,
        draftDescription: this.draftDescription,
        draft: this.draftRect(),
      },
      {
        loadFile: (file) => void this.loadFile(file),
        chooseFile: () => this.chooseFile(),
        focus: () => this.focus(),
        setDraggingFile: (value) => {
          this.isDraggingFile = value;
        },
        setStretchToWidth: (value) => {
          this.stretchToWidth = value;
          this.emitChange();
        },
        setDraftDescription: (value) => {
          this.draftDescription = value;
        },
        dropFile: (event) => this.dropFile(event),
        startDraw: (event) => this.startDraw(event),
        moveDraw: (event) => this.moveDraw(event),
        finishDraw: (event) => this.finishDraw(event),
        openRegion: (event, region) => this.openRegion(event, region),
        editRegion: (region) => {
          this.editingId = region.id;
          this.draftDescription = region.description;
        },
        sendRegionToBack: () => this.sendRegionToBack(),
        deleteRegion: () => this.deleteRegion(),
        saveDescription: () => this.saveDescription(),
      },
    );
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
  return { version: 1, image, annotations, stretchToWidth: data?.stretchToWidth !== false };
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
