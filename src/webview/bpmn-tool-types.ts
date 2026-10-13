export type BpmnData = {
  xml: string;
  svg: string;
  fileName?: string;
};

export type BpmnToolArgs = { data?: Partial<BpmnData> };

export type BpmnCanvasService = { zoom(value: 'fit-viewport'): void };
