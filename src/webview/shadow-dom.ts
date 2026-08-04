export function isNodeInsideSelector(node: Node, selector: string): boolean {
  let element: Element | null = node instanceof Element ? node : node.parentElement;
  while (element) {
    if (element.matches(selector) || element.closest(selector)) return true;
    const root = element.getRootNode();
    element = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}
