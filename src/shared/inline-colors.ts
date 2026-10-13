export function normalizeHexColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
}

export function readInlineColors(attributes: string): { color: string; background: string } {
  const style = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attributes);
  const declarations = style?.[1] ?? style?.[2] ?? '';
  const property = (name: string) =>
    new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*(#[0-9a-f]{6})(?=\\s*(?:;|$))`, 'i').exec(declarations)?.[1];
  const data = (name: string) =>
    new RegExp(`\\bdata-slash-text-${name}\\s*=\\s*["'](#[0-9a-f]{6})["']`, 'i').exec(attributes)?.[1];
  return {
    color: normalizeHexColor(data('color') ?? property('color')),
    background: normalizeHexColor(data('background') ?? property('background-color')),
  };
}
