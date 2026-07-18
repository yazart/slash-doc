import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { BpmnToolBase } from './bpmn-tool-base';
import type { BpmnCanvasService, BpmnData } from './bpmn-tool-types';
import { bpmnErrorMessage } from './bpmn-tool-utils';
import { LUCIDE_ICONS } from './lucide-icons';

export class BpmnPreviewTool extends BpmnToolBase {
  private viewer?: NavigatedViewer;
  private textarea?: HTMLTextAreaElement;
  private importTimer?: ReturnType<typeof setTimeout>;
  private importPromise: Promise<void> = Promise.resolve();

  static get toolbox() {
    return { title: 'BPMN Preview', icon: LUCIDE_ICONS.fileSearch };
  }

  render(): HTMLElement {
    const root = this.createRoot('slash-bpmn-preview-tool', 'BPMN Preview');
    const controls = document.createElement('div');
    controls.className = 'slash-bpmn-preview-controls';
    const fileLabel = document.createElement('label');
    fileLabel.className = 'slash-bpmn-button';
    fileLabel.textContent = 'Выбрать XML';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.bpmn,.xml,application/xml,text/xml';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => void this.readFile(fileInput.files?.[0]));
    fileLabel.append(fileInput);
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'slash-bpmn-xml';
    this.textarea.placeholder = 'Вставьте BPMN XML или перетащите сюда XML-файл';
    this.textarea.spellcheck = false;
    this.textarea.value = this.data.xml;
    this.textarea.addEventListener('input', () => this.scheduleImport());
    controls.append(fileLabel, this.textarea);
    root.insertBefore(controls, this.canvas ?? null);

    root.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    });
    root.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      event.preventDefault();
      void this.readFile(file);
    });

    this.viewer = new NavigatedViewer({ container: this.canvas });
    if (this.data.xml.trim()) void this.queueImport(this.data.xml, false);
    return root;
  }

  async save(): Promise<BpmnData> {
    if (this.importTimer) {
      clearTimeout(this.importTimer);
      this.importTimer = undefined;
      void this.queueImport(this.textarea?.value ?? '', false);
    }
    await this.importPromise;
    return { ...this.data, xml: this.textarea?.value ?? this.data.xml };
  }

  destroy(): void {
    if (this.importTimer) clearTimeout(this.importTimer);
    this.viewer?.destroy();
  }

  private async readFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const xml = await file.text();
    this.data.fileName = file.name;
    if (this.textarea) this.textarea.value = xml;
    await this.queueImport(xml, true);
  }

  private scheduleImport(): void {
    if (this.importTimer) clearTimeout(this.importTimer);
    this.importTimer = setTimeout(() => {
      this.importTimer = undefined;
      void this.queueImport(this.textarea?.value ?? '', true);
    }, 450);
  }

  private queueImport(xml: string, notify: boolean): Promise<void> {
    this.importPromise = this.importPromise.then(() => this.importXml(xml, notify));
    return this.importPromise;
  }

  private async importXml(xml: string, notify: boolean): Promise<void> {
    if (!this.viewer) return;
    this.data.xml = xml;
    if (!xml.trim()) {
      this.data.svg = '';
      this.setStatus('Добавьте BPMN XML');
      if (notify) this.changed();
      return;
    }
    this.setStatus('Загрузка…');
    try {
      await this.viewer.importXML(xml);
      const { svg } = await this.viewer.saveSVG();
      this.data.svg = svg ?? '';
      this.fitViewport();
      this.setStatus(this.data.fileName ?? '');
      if (notify) this.changed();
    } catch (error) {
      this.setStatus(bpmnErrorMessage(error, 'Некорректный BPMN XML.'), true);
    }
  }

  private fitViewport(): void {
    if (!this.viewer) return;
    try {
      (this.viewer.get('canvas') as unknown as BpmnCanvasService).zoom('fit-viewport');
    } catch {
      // A hidden webview may not have measurable canvas bounds yet; SVG saving does not depend on zoom.
    }
  }
}
