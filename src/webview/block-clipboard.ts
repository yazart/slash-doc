import type { OutputBlockData } from './block-editor-types';
export const BLOCK_CLIPBOARD_MIME = 'application/x-slash-doc-blocks+json';
export const BLOCK_CLIPBOARD_PREFIX = 'SLASH-DOC-BLOCKS/1\n';
export function encodeBlockClipboard(blocks: OutputBlockData[]): string {
  return BLOCK_CLIPBOARD_PREFIX + JSON.stringify({ version: 1, blocks });
}
export function decodeBlockClipboard(value: string): OutputBlockData[] | undefined {
  if (!value.startsWith(BLOCK_CLIPBOARD_PREFIX)) return undefined;
  try {
    const parsed = JSON.parse(value.slice(BLOCK_CLIPBOARD_PREFIX.length));
    if (parsed.version !== 1 || !Array.isArray(parsed.blocks) || !parsed.blocks.length) return undefined;
    if (!parsed.blocks.every((block: unknown) => isBlock(block))) return undefined;
    return structuredClone(parsed.blocks);
  } catch {
    return undefined;
  }
}
function isBlock(block: unknown): block is OutputBlockData {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
  const value = block as OutputBlockData;
  return (
    typeof value.type === 'string' &&
    value.type.length > 0 &&
    Boolean(value.data && typeof value.data === 'object' && !Array.isArray(value.data))
  );
}
/** Pasted blocks get fresh identities; source identities never alias the destination. */
export function cloneClipboardBlocks(
  blocks: OutputBlockData[],
  createId = () => crypto.randomUUID(),
): OutputBlockData[] {
  return structuredClone(blocks).map((block) => ({ ...block, id: createId() }));
}
