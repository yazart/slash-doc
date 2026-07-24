export function replaceClipboardRange(
  value: string,
  text: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { value: string; caret: number } {
  const start = clampOffset(selectionStart, value.length);
  const end = Math.max(start, clampOffset(selectionEnd, value.length));
  return {
    value: `${value.slice(0, start)}${text}${value.slice(end)}`,
    caret: start + text.length,
  };
}

function clampOffset(value: number | null, length: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(value, length)) : length;
}
