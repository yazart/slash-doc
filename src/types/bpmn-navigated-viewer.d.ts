declare module 'bpmn-js/lib/NavigatedViewer' {
  type BpmnOptions = {
    container?: Element | string;
  };

  export default class NavigatedViewer {
    constructor(options?: BpmnOptions);
    importXML(xml: string): Promise<unknown>;
    saveSVG(): Promise<{ svg?: string }>;
    get(name: string): unknown;
    destroy(): void;
  }
}
