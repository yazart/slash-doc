export type MigratedApprovalTableData = {
  rows: string[][];
  headerRow: boolean;
  headerColumn: boolean;
  columnWidths: number[];
  rowHeights: number[];
};

export function migrateApprovalTableData(value: unknown): MigratedApprovalTableData {
  const source = isRecord(value) && Array.isArray(value.rows) ? value.rows : [];
  const rows = source
    .filter(isRecord)
    .map((row) => [text(row.stage), renderResponsibles(row.responsibles), text(row.result)]);
  return {
    rows: [['Этап', 'Ответственные', 'Результат'], ...(rows.length > 0 ? rows : [['', '', '']])],
    headerRow: true,
    headerColumn: false,
    columnWidths: [],
    rowHeights: [],
  };
}

function renderResponsibles(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.filter(isRecord).map(renderUserMention).filter(Boolean).join(' ');
}

function renderUserMention(user: Record<string, unknown>): string {
  const fullName = text(user.fullName).trim();
  const email = text(user.email).trim();
  if (!fullName && !email) return '';
  const label = `@${fullName || email}`;
  const link = safeHttpUrl(text(user.link));
  if (!link) return escapeHtml(label);
  const attributes = [
    ['id', text(user.id)],
    ['name', fullName],
    ['email', email],
    ['photo', text(user.photo)],
    ['link', link],
  ]
    .filter(([, attribute]) => attribute)
    .map(([name, attribute]) => ` data-user-${name}="${escapeAttribute(attribute)}"`)
    .join('');
  return `<a class="slash-user-mention" contenteditable="false" href="${escapeAttribute(link)}"${attributes} target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;').replaceAll('`', '&#96;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
