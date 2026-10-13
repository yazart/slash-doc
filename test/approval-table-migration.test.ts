import { describe, expect, it } from 'vitest';
import { migrateApprovalTableData } from '../src/shared/approval-table-migration';
import { exportPageContent } from '../src/extension/document-export';
import { importHtmlBlocks } from '../src/extension/document-import-html';
import { getDefaultSettings } from '../src/extension/settings';
import { normalizeEditorData } from '../src/webview/editor-data';

const legacyData = {
  rows: [
    {
      id: 'approval-1',
      stage: 'Архитектура',
      responsibles: [
        {
          id: 'user-1',
          fullName: 'Иван Петров',
          email: 'ivan@example.com',
          photo: 'https://example.com/ivan.png',
          link: 'https://example.com/users/1',
        },
      ],
      result: 'Согласовано',
    },
  ],
};

describe('Approval Table migration', () => {
  it('converts responsible users to inline userSearch mentions', () => {
    const migrated = migrateApprovalTableData(legacyData);

    expect(migrated.headerRow).toBe(true);
    expect(migrated.rows[0]).toEqual(['Этап', 'Ответственные', 'Результат']);
    expect(migrated.rows[1][1]).toContain('class="slash-user-mention"');
    expect(migrated.rows[1][1]).toContain('data-user-id="user-1"');
    expect(migrated.rows[1][1]).toContain('data-user-email="ivan@example.com"');
  });

  it('migrates legacy Editor.js blocks while loading a page', () => {
    const normalized = normalizeEditorData({ blocks: [{ type: 'approvalTable', data: legacyData }] });

    expect(normalized.blocks[0].type).toBe('confluenceTable');
    expect(normalized.blocks[0].data).toMatchObject({ headerRow: true, headerColumn: false });
  });

  it('exports unopened legacy blocks as Confluence tables', async () => {
    const html = await exportPageContent(
      { blocks: [{ type: 'approvalTable', data: legacyData }] },
      'html',
      getDefaultSettings(),
    );

    expect(html).toContain('slash-doc-export-block-confluenceTable');
    expect(html).toContain('class="slash-user-mention"');
    expect(html).not.toContain('data-slash-doc-approval-table');
  });

  it('imports legacy Approval Table HTML directly as a Confluence table', () => {
    const state = Buffer.from(JSON.stringify(legacyData), 'utf8').toString('base64');
    const blocks = importHtmlBlocks(`<table data-slash-doc-approval-table="${state}"><tbody></tbody></table>`);

    expect(blocks[0]).toMatchObject({ type: 'confluenceTable', data: { headerRow: true } });
  });
});
