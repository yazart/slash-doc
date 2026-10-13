/* global document, window, requestAnimationFrame */
import assert from 'node:assert/strict';

export async function smokeBlockDragScroll(frame, page) {
  const original = await frame.evaluate(() => document.querySelector('slash-doc-editor').save());
  const viewport = page.viewport();
  await page.setViewport({ width: 1200, height: 1000 });
  await frame.evaluate(() => {
    if (!window.customElements.get('drag-scroll-probe'))
      window.customElements.define(
        'drag-scroll-probe',
        class extends window.HTMLElement {
          disconnectedCallback() {
            window.dragScrollDisconnects = (window.dragScrollDisconnects ?? 0) + 1;
          }
        },
      );
    document.querySelector('slash-doc-editor').config.tools.dragScrollProbe = class {
      render() {
        return document.createElement('drag-scroll-probe');
      }
      save() {
        return {};
      }
    };
  });
  const fixture = {
    blocks: [
      ...Array.from({ length: 70 }, (_, index) => ({
        id: `scroll-${index}`,
        type: 'paragraph',
        data: { text: `Block ${index}\nContent retained during drag` },
      })),
      { id: 'probe', type: 'dragScrollProbe', data: {} },
    ],
  };
  const setup = async (nested) =>
    frame.evaluate(
      async ({ fixture, nested }) => {
        const editor = document.querySelector('slash-doc-editor');
        await editor.render(fixture);
        const parent = editor.parentElement;
        if (nested) {
          if (parent.dataset.dragScrollStyle === undefined)
            parent.dataset.dragScrollStyle = parent.getAttribute('style') ?? '';
          Object.assign(parent.style, { height: '600px', overflow: 'auto' });
        }
        window.dragScrollScope = nested ? parent : document.scrollingElement;
        editor.views[20].holder.scrollIntoView({ block: 'center' });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const rect = editor.views[20].holder.getBoundingClientRect();
        const handle = editor.views[20].holder.querySelector('.slash-block-handle').getBoundingClientRect();
        const target = editor.views[23].holder.getBoundingClientRect();
        return {
          before: window.dragScrollScope.scrollTop,
          handle: { x: handle.left + handle.width / 2, y: handle.top + handle.height / 2 },
          block: { x: rect.right - 3, y: rect.top + 12 },
          target: { x: rect.right - 3, y: target.bottom - 6 },
        };
      },
      { fixture, nested },
    );
  const offset = () =>
    page.evaluate(() => {
      const iframe = document.querySelector('#slash-doc-gitlab')?.shadowRoot.querySelector('iframe');
      if (!iframe) return { x: 0, y: 0 };
      const rect = iframe.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    });
  const scrolled = () => frame.evaluate(() => window.dragScrollScope.scrollTop);
  try {
    for (const nested of [false, true]) {
      let positions = await setup(nested);
      let origin = await offset();
      assert.ok(positions.before > 500, 'Fixture starts far below the top');
      await page.mouse.click(origin.x + positions.handle.x, origin.y + positions.handle.y);
      assert.equal(
        await frame.evaluate(() => document.querySelector('slash-doc-editor').selected.has('scroll-20')),
        true,
        'Native handle click selects the block',
      );
      const selectionScroll = await scrolled();
      // Gather both phases before asserting, so failures identify selection or dropping.
      positions = await setup(nested);
      origin = await offset();
      await frame.evaluate((group) => {
        if (group) document.querySelector('slash-doc-editor').selectBlocks(['scroll-20', 'scroll-21'], 'scroll-20');
        window.dragScrollDisconnects = 0;
        window.dragScrollEvents = [];
        window.dragScrollListener = (event) => {
          window.dragScrollEvents.push({ type: event.type, top: window.dragScrollScope.scrollTop });
        };
        for (const type of ['dragstart', 'drop', 'dragend'])
          document.addEventListener(type, window.dragScrollListener, true);
      }, nested);
      await page.setDragInterception(true);
      await page.mouse.dragAndDrop(
        { x: origin.x + positions.block.x, y: origin.y + positions.block.y },
        { x: origin.x + positions.target.x, y: origin.y + positions.target.y },
      );
      await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await scrolled();
      const diagnostic = await frame.evaluate(() => ({
        events: window.dragScrollEvents,
        disconnections: window.dragScrollDisconnects,
        order: document.querySelector('slash-doc-editor').views.map((view) => view.output.id),
      }));
      assert.ok(Math.abs(selectionScroll - positions.before) < 2, 'Selecting a drag handle preserves scroll');
      assert.ok(
        diagnostic.events.some((event) => event.type === 'dragstart'),
        'Native dragstart fires',
      );
      assert.ok(Math.abs(after - positions.before) < 2, 'Dropping a block preserves the current scroll position');
      assert.equal(
        diagnostic.order[nested ? 22 : 23],
        'scroll-20',
        'Native drop moves block or group after its target',
      );
      if (nested) assert.equal(diagnostic.order[23], 'scroll-21', 'Group drag preserves relative order');
      assert.equal(diagnostic.disconnections, 0, 'Unmoved widgets remain connected during reorder');
      await frame.evaluate(() => {
        for (const type of ['dragstart', 'drop', 'dragend'])
          document.removeEventListener(type, window.dragScrollListener, true);
        const parent = document.querySelector('slash-doc-editor').parentElement;
        if (parent.dataset.dragScrollStyle !== undefined) {
          parent.setAttribute('style', parent.dataset.dragScrollStyle);
          delete parent.dataset.dragScrollStyle;
        }
      });
    }
    console.log(
      'Block drag scroll smoke passed: native handle selection and block dragging retain document and nested scroll positions.',
    );
  } finally {
    await page.mouse.up();
    await page.setDragInterception(false);
    await frame.evaluate(async (original) => {
      for (const type of ['dragstart', 'drop', 'dragend'])
        if (window.dragScrollListener) document.removeEventListener(type, window.dragScrollListener, true);
      const editor = document.querySelector('slash-doc-editor');
      const parent = editor.parentElement;
      if (parent.dataset.dragScrollStyle !== undefined) {
        parent.setAttribute('style', parent.dataset.dragScrollStyle);
        delete parent.dataset.dragScrollStyle;
      }
      delete window.dragScrollScope;
      delete window.dragScrollEvents;
      delete window.dragScrollListener;
      delete window.dragScrollDisconnects;
      delete editor.config.tools.dragScrollProbe;
      await editor.render(original);
    }, original);
    await page.setViewport(viewport);
  }
}
