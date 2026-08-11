import { describe, expect, it } from 'vitest';
import { exportBpmnSvg } from '../src/extension/document-export-common';

describe('BPMN HTML export dimensions', () => {
  it('restores zero SVG dimensions from BPMN DI bounds and waypoints', () => {
    const result = exportBpmnSvg('bpmnPreview', {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" viewBox="0 0 0 0"><path/></svg>',
      xml: `<bpmn:definitions xmlns:bpmn="urn:bpmn" xmlns:bpmndi="urn:bpmndi" xmlns:dc="urn:dc" xmlns:di="urn:di">
        <bpmndi:BPMNShape><dc:Bounds x="100" y="50" width="200" height="80" /></bpmndi:BPMNShape>
        <bpmndi:BPMNEdge><di:waypoint x="50" y="70"/><di:waypoint x="350" y="70"/></bpmndi:BPMNEdge>
      </bpmn:definitions>`,
    });

    expect(result).toContain('width="348" height="128" viewBox="26 26 348 128"');
    expect(result).not.toContain('viewBox="0 0 0 0"');
  });

  it('uses a valid viewBox when percentage dimensions cannot define an intrinsic size', () => {
    const result = exportBpmnSvg('bpmnModeler', {
      svg: '<svg width="100%" height="100%" viewBox="10 20 300 200"><rect/></svg>',
      xml: '',
    });

    expect(result).toContain('width="300" height="200" viewBox="10 20 300 200"');
  });
});
