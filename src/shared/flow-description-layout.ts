import {
  FLOW_DESCRIPTION_BASELINE,
  FLOW_DESCRIPTION_LINE_HEIGHT,
  FLOW_DESCRIPTION_MAX_CHARACTERS,
  FLOW_NODE_BOTTOM_PADDING,
  FLOW_NODE_HEIGHT,
} from './flow-designer-layout';

export function wrapFlowDescription(value: string): string[] {
  if (!value) return [];
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n').flatMap(wrapDescriptionLine);
}

export function getFlowNodeExportHeight(description: string): number {
  const lines = wrapFlowDescription(description);
  if (lines.length === 0) return FLOW_NODE_HEIGHT;
  return Math.max(
    FLOW_NODE_HEIGHT,
    FLOW_DESCRIPTION_BASELINE + (lines.length - 1) * FLOW_DESCRIPTION_LINE_HEIGHT + FLOW_NODE_BOTTOM_PADDING,
  );
}

function wrapDescriptionLine(value: string): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';

  for (const token of words) {
    let word = token;
    if (current && current.length + word.length + 1 <= FLOW_DESCRIPTION_MAX_CHARACTERS) {
      current += ` ${word}`;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    while (word.length > FLOW_DESCRIPTION_MAX_CHARACTERS) {
      lines.push(word.slice(0, FLOW_DESCRIPTION_MAX_CHARACTERS));
      word = word.slice(FLOW_DESCRIPTION_MAX_CHARACTERS);
    }
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}
