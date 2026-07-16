declare module 'bpmn-js/lib/Modeler' {
  type BpmnOptions = {
    container?: Element | string;
  };

  type XmlResult = {
    xml?: string;
  };

  type SvgResult = {
    svg?: string;
  };

  export default class Modeler {
    constructor(options?: BpmnOptions);
    importXML(xml: string): Promise<unknown>;
    saveXML(options?: { format?: boolean }): Promise<XmlResult>;
    saveSVG(): Promise<SvgResult>;
    get(name: string): unknown;
    on(event: string, callback: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}

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
