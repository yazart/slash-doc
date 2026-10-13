import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { smokeBlockDragScroll } from './block-drag-scroll-smoke.mjs';

const output = resolve('dist');
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/webview.css"></head>
<body><main class="shell"><header class="toolbar"><h1 class="title">Slash Doc</h1><div class="export-actions"><span id="save-status"></span><button id="save-page">Save</button><button id="export-html">HTML</button><button id="export-md">Markdown</button></div></header><section id="editor" aria-label="Редактор документа"></section></main>
<script>window.acquireVsCodeApi=()=>({postMessage(){}});window.__SLASH_DOC_INITIAL_DATA__={blocks:[{id:'original',type:'paragraph',data:{text:'Original'}}]};window.__SLASH_DOC_SETTINGS__={autoSave:{enabled:false}};window.__SLASH_DOC_FOCUS_EDITOR__=false;</script><script src="/webview.js"></script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/') {
      response.setHeader('content-type', 'text/html');
      response.end(html);
      return;
    }
    const file = resolve(output, `.${path}`);
    if (!file.startsWith(`${output}/`)) throw new Error('Invalid path');
    response.setHeader(
      'content-type',
      path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream',
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.SLASH_DOC_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForSelector('slash-doc-editor .ce-paragraph');
  await smokeBlockDragScroll(page, page);
  assert.deepEqual(errors, []);
  console.log('Main editor drag smoke passed using dist/webview.js and dist/webview.css.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
