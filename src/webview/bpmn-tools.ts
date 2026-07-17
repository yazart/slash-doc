import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { LUCIDE_ICONS } from './lucide-icons';

type BpmnData = {
  xml: string;
  svg: string;
  fileName?: string;
};

type ToolArgs = {
  data?: Partial<BpmnData>;
};

type CanvasService = {
  zoom(value: 'fit-viewport'): void;
};

const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Activity_1" name="Задача">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="EndEvent_1">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Activity_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="112" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_1_di" bpmnElement="Activity_1"><dc:Bounds x="250" y="90" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="404" y="112" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="196" y="130" /><di:waypoint x="250" y="130" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="350" y="130" /><di:waypoint x="404" y="130" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

abstract class BpmnToolBase {
  protected data: BpmnData;
  protected root?: HTMLDivElement;
  protected canvas?: HTMLDivElement;
  protected status?: HTMLDivElement;

  constructor({ data }: ToolArgs) {
    this.data = {
      xml: typeof data?.xml === 'string' ? data.xml : '',
      svg: typeof data?.svg === 'string' ? data.svg : '',
      fileName: typeof data?.fileName === 'string' ? data.fileName : undefined,
    };
  }

  protected createRoot(className: string, titleText: string): HTMLDivElement {
    const root = document.createElement('div');
    root.className = `slash-bpmn-tool ${className}`;
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' || (event.key === 'Enter' && event.target instanceof HTMLTextAreaElement)) {
        event.stopPropagation();
      }
    });

    const header = document.createElement('div');
    header.className = 'slash-bpmn-header';
    const title = document.createElement('strong');
    title.textContent = titleText;
    this.status = document.createElement('div');
    this.status.className = 'slash-bpmn-status';
    header.append(title, this.status);

    this.canvas = document.createElement('div');
    this.canvas.className = 'slash-bpmn-canvas';
    root.append(header, this.canvas);
    this.root = root;
    return root;
  }

  protected setStatus(message = '', error = false): void {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('slash-bpmn-status-error', error);
  }

  protected changed(): void {
    this.root?.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export class BpmnModelerTool extends BpmnToolBase {
  private modeler?: Modeler;
  private snapshotTimer?: ReturnType<typeof setTimeout>;
  private snapshotPromise: Promise<void> = Promise.resolve();

  static get toolbox() {
    return { title: 'BPMN Modeler', icon: LUCIDE_ICONS.penTool };
  }

  render(): HTMLElement {
    const root = this.createRoot('slash-bpmn-modeler-tool', 'BPMN Modeler');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'slash-bpmn-button';
    reset.textContent = 'Новая диаграмма';
    reset.addEventListener('click', () => void this.importDiagram(EMPTY_BPMN_XML));
    this.status?.before(reset);

    this.modeler = new Modeler({ container: this.canvas });
    this.modeler.on('commandStack.changed', () => this.scheduleSnapshot());
    void this.importDiagram(this.data.xml || EMPTY_BPMN_XML);
    return root;
  }

  async save(): Promise<BpmnData> {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = undefined;
      this.queueSnapshot(false);
    }
    await this.snapshotPromise;
    return { ...this.data };
  }

  destroy(): void {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.modeler?.destroy();
  }

  private async importDiagram(xml: string): Promise<void> {
    if (!this.modeler) return;
    this.setStatus('Загрузка…');
    try {
      await this.modeler.importXML(xml);
      (this.modeler.get('canvas') as unknown as CanvasService).zoom('fit-viewport');
      await this.snapshot(false);
      this.setStatus('');
      this.changed();
    } catch (error) {
      this.setStatus(errorMessage(error, 'Не удалось открыть BPMN-диаграмму.'), true);
    }
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = undefined;
      this.queueSnapshot(true);
    }, 250);
  }

  private queueSnapshot(notify: boolean): void {
    this.snapshotPromise = this.snapshotPromise.then(() => this.snapshot(notify));
  }

  private async snapshot(notify: boolean): Promise<void> {
    if (!this.modeler) return;
    const [{ xml }, { svg }] = await Promise.all([this.modeler.saveXML({ format: true }), this.modeler.saveSVG()]);
    this.data.xml = xml ?? this.data.xml;
    this.data.svg = svg ?? this.data.svg;
    if (notify) this.changed();
  }
}

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
      (this.viewer.get('canvas') as unknown as CanvasService).zoom('fit-viewport');
      const { svg } = await this.viewer.saveSVG();
      this.data.svg = svg ?? '';
      this.setStatus(this.data.fileName ?? '');
      if (notify) this.changed();
    } catch (error) {
      this.setStatus(errorMessage(error, 'Некорректный BPMN XML.'), true);
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
