/** A text block stores headings as an optional level; legacy header blocks remain readable. */
export function textHeadingLevel(block: { type?: unknown; data?: unknown }): number {
  const data = block.data && typeof block.data === 'object' ? (block.data as Record<string, unknown>) : {};
  const level = Number(data.level);
  if (block.type === 'paragraph') return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 0;
  if (block.type === 'header') return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
  return 0;
}
