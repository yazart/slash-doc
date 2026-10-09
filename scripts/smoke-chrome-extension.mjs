/* global window, document */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { stringify, parse } from 'yaml';

const output = resolve('dist/chrome-extension');
const loadExtension = process.env.SLASH_DOC_CHROME_REAL_EXTENSION === '1';
const source = stringify({
  storage: { format: 'slash-doc-page', version: 1 },
  editor: {
    blocks: [
      { id: 'intro', type: 'paragraph', data: { text: 'Original paragraph' } },
      {
        id: 'table',
        type: 'confluenceTable',
        data: {
          rows: [
            ['Name', 'Value'],
            ['API', 'Ready'],
          ],
          headerRow: true,
        },
      },
      { id: 'code', type: 'codeBlock', data: { code: 'const ready = true;', language: 'typescript' } },
    ],
  },
});
const fixture = `<!doctype html><html><body>
  <button type="button" data-testid="blob-edit-header-commit-button">Commit changes</button>
  <form class="js-edit-blob-form"><div id="editor"><div class="monaco-editor"></div></div><button id="submit" type="submit">Commit form</button></form>
</body></html>`;
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.includes('/-/edit/')) {
      response.setHeader('content-type', 'text/html');
      response.end(fixture);
    } else if (pathname.endsWith('menu.json')) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ items: [{ id: 'page', title: 'Test page', children: [] }] }));
    } else if (pathname.startsWith('/api/')) {
      response.setHeader('content-type', 'application/json');
      response.end('[]');
    } else {
      const file = resolve(output, `.${pathname}`);
      if (!file.startsWith(`${output}/`)) throw new Error('Invalid path');
      if (pathname === '/editor.html')
        response.setHeader('content-security-policy', "script-src 'self'; object-src 'none';");
      response.setHeader(
        'content-type',
        pathname.endsWith('.js') ? 'application/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(await readFile(file));
    }
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.SLASH_DOC_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: !loadExtension,
    ignoreDefaultArgs: loadExtension ? ['--disable-extensions'] : [],
    args: loadExtension
      ? ['--headless=new', '--no-sandbox', `--disable-extensions-except=${output}`, `--load-extension=${output}`]
      : ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('Browser error:', error.message);
  });
  await page.goto(`${origin}/group/project/-/edit/main/.slash-doc/docs/pages/page/content.yaml`);
  if (!loadExtension) await page.addScriptTag({ path: resolve(output, 'gitlab-editor-bridge.js') });
  await page.evaluate(
    (source, origin, loadExtension) => {
      let value = source;
      if (!loadExtension) window.chrome = { runtime: { getURL: (path) => `${origin}/${path}` } };
      window.fixtureEditor = {
        getValue: () => value,
        setValue: (next) => {
          value = next;
        },
        layout() {},
      };
      document
        .querySelector('#editor')
        .dispatchEvent(new CustomEvent('editor-ready', { detail: { instance: window.fixtureEditor } }));
      document.querySelector('[data-testid="blob-edit-header-commit-button"]').addEventListener('click', () => {
        window.modalContent = value;
      });
      document.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault();
        window.committedContent = value;
      });
    },
    source,
    origin,
    loadExtension,
  );
  if (!loadExtension) await page.addScriptTag({ path: resolve(output, 'content.js') });
  await page.waitForFunction(
    () => {
      const frame = document.querySelector('#slash-doc-gitlab')?.shadowRoot?.querySelector('iframe');
      return frame && !frame.hidden;
    },
    { timeout: 20000 },
  );
  const frame = page.frames().find((frame) => frame.url().includes('/editor.html'));
  assert.ok(frame, 'Visual editor iframe mounted');
  await frame.waitForSelector('.ce-paragraph');
  await frame.evaluate(() => {
    const text = document.querySelector('.ce-paragraph');
    text.innerHTML = 'Visual change';
    text.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Toggle immediately, before the one-second autosave fires.
  await page.evaluate(() => document.querySelector('#slash-doc-gitlab').shadowRoot.querySelector('button').click());
  await page.waitForFunction(() => document.querySelector('#editor').style.display !== 'none');
  assert.equal(
    parse(await page.evaluate(() => window.fixtureEditor.getValue())).editor.blocks[0].data.text,
    'Visual change',
  );
  await page.evaluate(
    (source) => window.fixtureEditor.setValue(source.replace('Original paragraph', 'Native change')),
    source,
  );
  await page.evaluate(() => document.querySelector('#slash-doc-gitlab').shadowRoot.querySelector('button').click());
  await frame.waitForFunction(() => document.querySelector('.ce-paragraph')?.textContent === 'Native change');
  await frame.evaluate(() => {
    const text = document.querySelector('.ce-paragraph');
    text.innerHTML = 'Commit latest change';
    text.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('[data-testid="blob-edit-header-commit-button"]');
  await page.waitForFunction(() => Boolean(window.modalContent));
  assert.equal(
    parse(await page.evaluate(() => window.modalContent)).editor.blocks[0].data.text,
    'Commit latest change',
  );
  await frame.evaluate(() => {
    const text = document.querySelector('.ce-paragraph');
    text.innerHTML = 'Form latest change';
    text.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#submit');
  await page.waitForFunction(() => Boolean(window.committedContent));
  const committed = parse(await page.evaluate(() => window.committedContent));
  assert.equal(committed.editor.blocks[0].data.text, 'Form latest change');
  assert.equal(committed.editor.blocks[1].type, 'confluenceTable');
  assert.equal(committed.editor.blocks[2].type, 'codeBlock');
  assert.equal(committed.editor.time, undefined);
  assert.deepEqual(errors, []);
  console.log(
    'Chrome editor smoke passed: initial render, widgets, two-way switching, modal and form commit synchronization.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
