import { html, svg, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderSafeMarkdown } from '../shared/markdown';
import type { AnnotationImage, ImageRegion } from './image-annotation-element';

type Rectangle = { x: number; y: number; width: number; height: number };

export type ImageAnnotationTemplateState = {
  image: AnnotationImage | null;
  annotations: ImageRegion[];
  stretchToWidth: boolean;
  isDraggingFile: boolean;
  editingId: string | null;
  draftDescription: string;
  draft: Rectangle | null;
};

export type ImageAnnotationTemplateActions = {
  loadFile(file: File): void;
  chooseFile(): void;
  focus(): void;
  setDraggingFile(value: boolean): void;
  setStretchToWidth(value: boolean): void;
  setDraftDescription(value: string): void;
  dropFile(event: DragEvent): void;
  startDraw(event: PointerEvent): void;
  moveDraw(event: PointerEvent): void;
  finishDraw(event: PointerEvent): void;
  openRegion(event: PointerEvent, region: ImageRegion): void;
  editRegion(region: ImageRegion): void;
  sendRegionToBack(): void;
  deleteRegion(): void;
  saveDescription(): void;
};

export function renderImageAnnotationTemplate(
  state: ImageAnnotationTemplateState,
  actions: ImageAnnotationTemplateActions,
): TemplateResult {
  return html`<input
      type="file"
      accept="image/*"
      hidden
      @change=${(event: Event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) actions.loadFile(file);
        input.value = '';
      }}
    />${
      !state.image
        ? renderEmptyState(state, actions)
        : renderEditor(state as ImageAnnotationTemplateState & { image: AnnotationImage }, actions)
    }`;
}

function renderEmptyState(
  state: ImageAnnotationTemplateState,
  actions: ImageAnnotationTemplateActions,
): TemplateResult {
  return html`<div
    class="empty ${state.isDraggingFile ? 'dragging' : ''}"
    @dragover=${(event: DragEvent) => {
      event.preventDefault();
      actions.setDraggingFile(true);
    }}
    @dragleave=${() => actions.setDraggingFile(false)}
    @drop=${actions.dropFile}
    @click=${actions.focus}
  >
    <div>
      <div class="empty-icon">▧</div>
      <h3>Аннотация изображения</h3>
      <p>Перетащите изображение сюда, вставьте его из буфера<br />или выберите файл.</p>
      <button
        class="button"
        @click=${(event: Event) => {
          event.stopPropagation();
          actions.chooseFile();
        }}
      >
        Выбрать изображение
      </button>
    </div>
  </div>`;
}

function renderEditor(
  state: ImageAnnotationTemplateState & { image: AnnotationImage },
  actions: ImageAnnotationTemplateActions,
): TemplateResult {
  return html`<div class="editor" @dragover=${(event: DragEvent) => event.preventDefault()} @drop=${actions.dropFile}>
    <div class="toolbar">
      <p>Проведите по изображению, чтобы создать прямоугольную аннотацию. Нажмите на область для редактирования.</p>
      <div class="toolbar-actions">
        <label class="stretch-toggle"
          ><input
            type="checkbox"
            .checked=${state.stretchToWidth}
            @change=${(event: Event) => actions.setStretchToWidth((event.target as HTMLInputElement).checked)}
          />Растягивать по ширине</label
        ><button class="replace" @click=${actions.chooseFile}>Заменить изображение</button>
      </div>
    </div>
    <div
      class="frame ${state.stretchToWidth ? 'stretched' : 'natural'}"
      style=${`--annotation-image-width:${state.image.width}px`}
    >
      <img
        src=${state.image.dataUrl}
        alt=${state.image.name}
        width=${state.image.width}
        height=${state.image.height}
      /><svg
        class="overlay"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        @pointerdown=${actions.startDraw}
        @pointermove=${actions.moveDraw}
        @pointerup=${actions.finishDraw}
      >
        ${[...state.annotations]
          .sort((left, right) => left.zIndex - right.zIndex)
          .map(
            (region) =>
              svg`<rect class="region ${region.id === state.editingId ? 'active' : ''}" x=${region.x * 1000} y=${region.y * 1000} width=${region.width * 1000} height=${region.height * 1000} @pointerdown=${(event: PointerEvent) => actions.openRegion(event, region)}/>`,
          )}${
          state.draft
            ? svg`<rect class="draft" x=${state.draft.x * 1000} y=${state.draft.y * 1000} width=${state.draft.width * 1000} height=${state.draft.height * 1000}/>`
            : ''
        }</svg
      >${state.annotations.map(
        (region) =>
          html`<span class="region-number-bg" style=${`left:${region.x * 100}%;top:${region.y * 100}%`}
            >${region.number}</span
          >`,
      )}${state.editingId ? renderPopup(state, actions) : ''}
    </div>
    ${state.annotations.length ? renderAnnotationsTable(state.annotations, actions) : ''}
  </div>`;
}

function renderPopup(state: ImageAnnotationTemplateState, actions: ImageAnnotationTemplateActions): TemplateResult {
  return html`<div class="popup">
    <h4 class="popup-title">Аннотация ${state.annotations.find((item) => item.id === state.editingId)?.number}</h4>
    <textarea
      placeholder="Описание (поддерживается Markdown)"
      .value=${state.draftDescription}
      @input=${(event: Event) => actions.setDraftDescription((event.target as HTMLTextAreaElement).value)}
    ></textarea>
    <div class="popup-actions">
      <button class="send-back" @click=${actions.sendRegionToBack}>На задний план</button
      ><button class="delete" @click=${actions.deleteRegion}>Удалить</button
      ><button class="button" @click=${actions.saveDescription}>Сохранить</button>
    </div>
  </div>`;
}

function renderAnnotationsTable(annotations: ImageRegion[], actions: ImageAnnotationTemplateActions): TemplateResult {
  return html`<table>
    <thead>
      <tr>
        <th>#</th>
        <th>Описание</th>
      </tr>
    </thead>
    <tbody>
      ${annotations.map(
        (region) =>
          html`<tr @click=${() => actions.editRegion(region)}>
            <td>${region.number}</td>
            <td class="description">${unsafeHTML(renderSafeMarkdown(region.description || '—'))}</td>
          </tr>`,
      )}
    </tbody>
  </table>`;
}
