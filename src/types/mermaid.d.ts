declare module 'mermaid' {
  type MermaidConfig = Record<string, unknown>;

  type MermaidApi = {
    initialize(config: MermaidConfig): void;
    render(id: string, definition: string, callback: (svg: string) => void, container?: Element): void;
  };

  const mermaid: MermaidApi;
  export default mermaid;
}
