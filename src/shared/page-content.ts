export function removePageTime(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const content = { ...(value as Record<string, unknown>) };
  delete content.time;
  return content;
}
