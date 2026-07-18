import Modeler from 'bpmn-js/lib/Modeler';
import { BpmnToolBase } from './bpmn-tool-base';
import type { BpmnCanvasService, BpmnData } from './bpmn-tool-types';
import { bpmnErrorMessage } from './bpmn-tool-utils';
import { LUCIDE_ICONS } from './lucide-icons';

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
    this.snapshotPromise = this.importDiagram(this.data.xml || EMPTY_BPMN_XML);
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
      await this.snapshot(false);
      this.fitViewport();
      this.setStatus('');
      this.changed();
    } catch (error) {
      this.setStatus(bpmnErrorMessage(error, 'Не удалось открыть BPMN-диаграмму.'), true);
    }
  }

  private fitViewport(): void {
    if (!this.modeler) return;
    try {
      (this.modeler.get('canvas') as unknown as BpmnCanvasService).zoom('fit-viewport');
    } catch {
      // A hidden webview may not have measurable canvas bounds yet; SVG saving does not depend on zoom.
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
