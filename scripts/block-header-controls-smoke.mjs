/* global document, requestAnimationFrame */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function smokeBlockHeaderControls(frame, page) {
  const original = await frame.evaluate(() => document.querySelector('slash-doc-editor').save());
  const directory = await mkdtemp(join(tmpdir(), 'slash-doc-bpmn-'));
  try {
    const xml = await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      const check = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await editor.render({
        blocks: [
          { id: 'text', type: 'paragraph', data: { text: '<b>Convert me</b>' } },
          { id: 'code', type: 'codeBlock', data: { code: 'const ready = true;', language: 'typescript' } },
          { id: 'diff', type: 'diffBlock', data: { diff: '+ new\n- old' } },
          { id: 'modeler', type: 'bpmnModeler', data: {} },
          { id: 'preview', type: 'bpmnPreview', data: {} },
          { id: 'admonition', type: 'mkdocsAdmonition', data: { title: 'Note', content: '<b>Body</b>' } },
          { id: 'details', type: 'mkdocsDetails', data: { summary: 'More', content: 'Details body' } },
          {
            id: 'tabs',
            type: 'mkdocsTabs',
            data: {
              tabs: [
                { id: 'one', title: 'One', content: 'First body' },
                { id: 'two', title: 'Two', content: 'Second body' },
              ],
            },
          },
          {
            id: 'checklist',
            type: 'mkdocsChecklist',
            data: { items: [{ id: 'item', text: 'First item', checked: false, level: 0 }] },
          },
        ],
      });
      const view = (id) => editor.views.find((view) => view.output.id === id);
      const header = (id) => view(id).holder.querySelector('.slash-block-controls');
      const body = (id) => view(id).content.querySelector('slash-tool-surface').shadowRoot;
      for (const id of ['code', 'diff', 'modeler', 'preview', 'admonition', 'details', 'tabs', 'checklist']) {
        check(
          !body(id).querySelector('.slash-code-toolbar, .slash-bpmn-header, .mkdocs-widget-header'),
          `${id}: body has no duplicate header`,
        );
        if (id !== 'diff')
          check(header(id).querySelector('.slash-block-tool-controls'), `${id}: controls live in common header`);
        const separator = header(id).querySelector('.slash-block-controls-separator');
        check(separator.nextElementSibling.title === 'Переместить вверх', `${id}: separator precedes standard actions`);
        check(
          Array.from(header(id).children)
            .slice(-4)
            .map((button) => button.title)
            .join('|') === 'Переместить вверх|Переместить вниз|Копировать блок|Удалить блок',
          `${id}: standard actions retain order`,
        );
      }
      const title = header('text').querySelector('.slash-block-title');
      title.click();
      const menu = document.querySelector('.slash-block-menu');
      check(menu?.getAttribute('aria-label') === 'Тип блока', 'Title opens type menu');
      menu.querySelector('[data-block-type="quote"]').click();
      await tick();
      let saved = await editor.save();
      check(
        saved.blocks[0].id === 'text' &&
          saved.blocks[0].type === 'quote' &&
          saved.blocks[0].data.text === '<b>Convert me</b>',
        'Title conversion preserves ID and rich text',
      );
      const language = header('code').querySelector('.slash-code-language');
      check(!body('code').querySelector('select'), 'Code language selector removed from body');
      language.value = 'javascript';
      language.dispatchEvent(new Event('change', { bubbles: true }));
      check(view('code').tool.save().language === 'javascript', 'Header language changes saved code and highlighting');
      const kind = header('admonition').querySelector('select');
      kind.value = 'warning';
      kind.dispatchEvent(new Event('change', { bubbles: true }));
      const noteTitle = header('admonition').querySelector('input[type="text"]');
      noteTitle.value = 'Warning';
      noteTitle.dispatchEvent(new Event('input', { bubbles: true }));
      header('admonition').querySelector('input[type="checkbox"]').click();
      check(
        !header('admonition').querySelectorAll('label')[1].hidden,
        'Collapsible setting reveals open setting in header',
      );
      const summary = header('details').querySelector('input[type="text"]');
      summary.value = 'Changed summary';
      summary.dispatchEvent(new Event('input', { bubbles: true }));
      header('details').querySelector('input[type="checkbox"]').click();
      check(
        !body('admonition').querySelector('input, select, button') &&
          !body('details').querySelector('input, select, button'),
        'MkDocs bodies contain only editable content',
      );
      header('tabs').querySelectorAll('.mkdocs-tabs-list button')[1].click();
      check(
        body('tabs').querySelector('.mkdocs-content').textContent === 'Second body',
        'Header tab selection switches content',
      );
      const tabTitle = header('tabs').querySelector('input');
      tabTitle.value = 'Renamed';
      tabTitle.dispatchEvent(new Event('input', { bubbles: true }));
      header('tabs').querySelector('[title="Добавить вкладку"]').click();
      check(view('tabs').tool.save().tabs.length === 3, 'Header adds tab');
      header('tabs').querySelector('[title="Удалить вкладку"]').click();
      check(
        view('tabs').tool.save().tabs[1].title === 'Renamed' && !body('tabs').querySelector('input, button'),
        'Header removes tab and retains renamed content',
      );
      header('checklist').querySelector('[title="Добавить пункт"]').click();
      header('checklist').querySelector('[title="Увеличить отступ пункта"]').click();
      check(
        view('checklist').tool.save().items[1].level === 1,
        'Header checklist controls retain active item and indentation',
      );
      header('checklist').querySelector('[title="Удалить выбранный пункт"]').click();
      check(view('checklist').tool.save().items.length === 1, 'Header checklist removes active item');
      const initialDiagram = (await editor.save()).blocks.find((block) => block.id === 'modeler').data;
      check(
        initialDiagram.xml.includes('bpmn:task') && initialDiagram.svg.includes('<svg'),
        'BPMN modeler creates and exports its diagram',
      );
      const modeler = view('modeler').tool;
      modeler.modeler
        .get('modeling')
        .updateProperties(modeler.modeler.get('elementRegistry').get('Activity_1'), { name: 'Changed task' });
      header('modeler').querySelector('[title="Новая диаграмма"]').click();
      saved = await editor.save();
      const resetDiagram = saved.blocks.find((block) => block.id === 'modeler').data;
      check(
        resetDiagram.xml.includes('name="Задача"') && !resetDiagram.xml.includes('Changed task'),
        'Header reset finishes before save',
      );
      check(
        saved.blocks.find((block) => block.id === 'admonition').data.kind === 'warning' &&
          saved.blocks.find((block) => block.id === 'admonition').data.collapsible,
        'Moved MkDocs settings persist',
      );
      check(
        saved.blocks.find((block) => block.id === 'details').data.summary === 'Changed summary' &&
          saved.blocks.find((block) => block.id === 'details').data.open,
        'Moved details settings persist',
      );
      await editor.render(saved);
      check(
        header('code').querySelector('select').value === 'javascript' &&
          header('admonition').querySelector('input[type="text"]').value === 'Warning',
        'Header settings survive reload',
      );
      return resetDiagram.xml;
    });
    const filePath = join(directory, 'diagram.bpmn');
    await writeFile(filePath, xml);
    const chooserPromise = page.waitForFileChooser();
    await (await frame.$('[data-id="preview"] .slash-block-controls [title="Выбрать XML"]')).click();
    await (await chooserPromise).accept([filePath]);
    await frame.waitForFunction(() => {
      const tool = document.querySelector('slash-doc-editor').views.find((view) => view.output.id === 'preview').tool;
      return tool.data.fileName === 'diagram.bpmn' && tool.data.svg.includes('<svg');
    });
    const saved = await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      const saved = await editor.save();
      await editor.api.readOnly.toggle(true);
      if (editor.querySelector('.slash-block-controls')) throw new Error('Read-only editor exposes header controls');
      return saved;
    });
    assert.equal(saved.blocks.find((block) => block.id === 'preview').data.xml, xml);
    console.log(
      'Block header smoke passed: title conversion, separators, code/MkDocs settings, BPMN reset/file dialog, save/reload and read-only.',
    );
  } finally {
    await frame.evaluate(async (original) => {
      const editor = document.querySelector('slash-doc-editor');
      editor.config.readOnly = false;
      await editor.render(original);
    }, original);
    await rm(directory, { recursive: true, force: true });
  }
}
