export type InlineFormatMatcher = (element: Element) => boolean;

type ToggleInlineFormatOptions = {
  create: () => HTMLElement;
  matcher: InlineFormatMatcher;
  normalizeMatcher?: InlineFormatMatcher;
};

export function toggleInlineFormat(
  container: HTMLElement,
  sourceRange: Range,
  options: ToggleInlineFormatOptions,
): Range {
  const range = sourceRange.cloneRange();
  if (range.collapsed || !container.contains(range.commonAncestorContainer)) return range;
  if (isInlineFormatActive(container, range, options.matcher)) {
    return removeInlineFormat(container, range, options.matcher);
  }
  const normalizeMatcher = options.normalizeMatcher ?? options.matcher;
  const normalizedRange = hasInlineFormat(container, range, normalizeMatcher)
    ? removeInlineFormat(container, range, normalizeMatcher)
    : range;
  return applyInlineFormat(normalizedRange, options.create, normalizeMatcher);
}

function hasInlineFormat(container: HTMLElement, range: Range, matcher: InlineFormatMatcher): boolean {
  return selectedTextNodes(container, range).some((node) => Boolean(findMatchingAncestor(node, container, matcher)));
}

export function isInlineFormatActive(container: HTMLElement, range: Range, matcher: InlineFormatMatcher): boolean {
  const textNodes = selectedTextNodes(container, range);
  return textNodes.length > 0 && textNodes.every((node) => Boolean(findMatchingAncestor(node, container, matcher)));
}

function applyInlineFormat(range: Range, create: () => HTMLElement, normalizeMatcher: InlineFormatMatcher): Range {
  const fragment = range.extractContents();
  unwrapMatchingDescendants(fragment, normalizeMatcher);
  const wrapper = create();
  wrapper.append(fragment);
  range.insertNode(wrapper);
  return rangeAroundContents(wrapper);
}

function removeInlineFormat(container: HTMLElement, range: Range, matcher: InlineFormatMatcher): Range {
  const fragment = range.extractContents();
  unwrapMatchingDescendants(fragment, matcher);
  const marker = document.createElement('span');
  marker.dataset.slashInlineSelection = '';
  marker.append(fragment);
  range.insertNode(marker);

  let ancestor = findMatchingAncestor(marker, container, matcher);
  while (ancestor) {
    isolateMarkerOutsideAncestor(marker, ancestor);
    ancestor = findMatchingAncestor(marker, container, matcher);
  }
  return unwrapSelectionMarker(marker);
}

function isolateMarkerOutsideAncestor(marker: HTMLElement, target: Element): void {
  let segment: Node = marker;
  while (segment.parentNode && segment.parentNode !== target) {
    const parent = segment.parentNode;
    if (!(parent instanceof Element)) break;
    segment = splitElementAroundSegment(parent, segment, true);
  }
  if (segment.parentNode === target) splitElementAroundSegment(target, segment, false);
}

function splitElementAroundSegment(parent: Element, segment: Node, preserveWrapper: boolean): Node {
  const grandparent = parent.parentNode;
  if (!grandparent) return segment;
  const after = parent.cloneNode(false) as Element;
  while (segment.nextSibling) after.append(segment.nextSibling);

  let selected: Node = segment;
  if (preserveWrapper) {
    const selectedWrapper = parent.cloneNode(false) as Element;
    selectedWrapper.append(segment);
    selected = selectedWrapper;
  }
  grandparent.insertBefore(selected, parent.nextSibling);
  if (hasMeaningfulContent(after)) grandparent.insertBefore(after, selected.nextSibling);
  if (!hasMeaningfulContent(parent)) parent.remove();
  grandparent.normalize();
  return selected;
}

function hasMeaningfulContent(element: Element): boolean {
  return Boolean(element.textContent || element.querySelector('br,img,svg,video,audio,input'));
}

function unwrapSelectionMarker(marker: HTMLElement): Range {
  const parent = marker.parentNode;
  if (!parent || !marker.firstChild || !marker.lastChild) return document.createRange();
  const first = marker.firstChild;
  const last = marker.lastChild;
  while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
  marker.remove();
  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  return range;
}

function unwrapMatchingDescendants(root: ParentNode, matcher: InlineFormatMatcher): void {
  const matches = Array.from(root.querySelectorAll('*')).filter(matcher).reverse();
  for (const element of matches) unwrapElement(element);
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}

function selectedTextNodes(container: HTMLElement, range: Range): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current.textContent && range.intersectsNode(current)) nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function findMatchingAncestor(node: Node, container: HTMLElement, matcher: InlineFormatMatcher): Element | undefined {
  let current = node instanceof Element ? node : node.parentElement;
  while (current && current !== container) {
    if (matcher(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

function rangeAroundContents(element: Element): Range {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range;
}
