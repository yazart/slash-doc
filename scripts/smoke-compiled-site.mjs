/* global document, window, location, getComputedStyle, DOMParser */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'slash-doc-site-smoke-'));
const output = join(root, 'site');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=';
const imageUrl = `data:image/png;base64,${png}`;
const errors = [];
let browser;
let server;
try {
  await mkdir(join(root, '.slash-doc', 'docs', 'pages'), { recursive: true });
  await writeFile(
    join(root, '.slash-doc', 'sdsettings.json'),
    JSON.stringify({
      exportOptions: {
        separateFiles: true,
        showPageNavigation: true,
        showRepositoryLink: true,
        repositoryUrl: 'https://gitlab.example/group/project',
      },
    }),
  );
  const menu = [
    {
      id: 'first',
      title: 'First',
      file: 'first/content.json',
      children: [{ id: 'child', title: 'Child', file: 'child/content.json', children: [] }],
    },
    { id: 'last', title: 'Last', file: 'last/content.json', children: [] },
  ];
  await writeFile(join(root, '.slash-doc', 'docs', 'menu.json'), JSON.stringify({ items: menu }));
  for (const id of ['first', 'child', 'last']) {
    const directory = join(root, '.slash-doc', 'docs', 'pages', id);
    await mkdir(directory);
    await writeFile(
      join(directory, 'content.json'),
      JSON.stringify({
        blocks: [
          { type: 'paragraph', data: { text: id, level: 1 } },
          { type: 'paragraph', data: { text: `<a href="${imageUrl}">Download picture</a>` } },
          { type: 'image', data: { file: { url: imageUrl } } },
          {
            type: 'mkdocsGrid',
            data: {
              cards: true,
              items: [
                { id: 'grid-first', content: '## Grid first\n\n[Details](slash-doc://page/child)' },
                { id: 'grid-second', content: '<b>Second card</b><ul><li>Content</li></ul>' },
              ],
            },
          },
          {
            type: 'mermaid',
            data: {
              code: '',
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" data-slash-doc-mermaid-state="state"><image href="${imageUrl}" width="16" height="16"/></svg>`,
            },
          },
        ],
      }),
    );
  }
  await execFileAsync(process.execPath, [resolve('dist/slash-doc-compile.js'), root, '--output', output]);
  browser = await puppeteer.launch({
    executablePath: process.env.SLASH_DOC_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const checkCopiedImages = async (frame) => {
    const result = await frame.evaluate(async () => {
      let copied;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value) => {
            copied = value;
          },
        },
      });
      document.querySelector('[data-slash-doc-copy-control]').click();
      await Promise.resolve();
      await Promise.resolve();
      const clone = new DOMParser().parseFromString(copied, 'text/html');
      return {
        source: copied,
        images: [...clone.querySelectorAll('img')].map((image) => image.getAttribute('src')),
        imageLink: Array.from(clone.querySelectorAll('a'))
          .find((link) => link.textContent === 'Download picture')
          ?.getAttribute('href'),
        controls: !!clone.querySelector(
          '[data-slash-doc-copy-control], [data-slash-doc-copy-script], [data-slash-doc-copy-images], [data-slash-doc-page-navigation]',
        ),
        creator: clone.querySelector('.slash-doc-page-creator')?.textContent,
        success: document.querySelector('[data-slash-doc-copy-control]').classList.contains('copied'),
      };
    });
    assert.equal(result.success, true);
    assert.equal(result.images[0], imageUrl);
    assert.equal(result.imageLink, imageUrl);
    assert.ok(result.images[1].startsWith('data:image/svg+xml;base64,'));
    const svg = Buffer.from(result.images[1].split(',')[1], 'base64').toString('utf8');
    assert.ok(svg.includes(`href="${imageUrl}"`), 'SVG clipboard data embeds its dependent image');
    assert.ok(!svg.includes('first-image-'), 'SVG clipboard data has no local dependencies');
    assert.equal(result.controls, false);
    assert.ok(result.creator?.startsWith('Создал:'));
    assert.ok(result.source.startsWith('<!DOCTYPE html>\n'));
    // Copying does not alter the displayed extracted resources.
    assert.equal(await frame.$eval('img', (image) => image.getAttribute('src')), 'first-image-1.png');
  };

  await page.goto(pathToFileURL(join(output, 'pages', 'first.html')).href);
  const gridLayout = await page.evaluate(() => {
    const grid = document.querySelector('.slash-mkdocs-grid');
    grid.style.width = '700px';
    const wide = Array.from(grid.children, (item) => item.getBoundingClientRect().top);
    grid.style.width = '240px';
    const narrow = Array.from(grid.children, (item) => item.getBoundingClientRect().top);
    const width = grid.firstElementChild.getBoundingClientRect().width;
    const link = grid.querySelector('a').getAttribute('href');
    grid.style.width = '';
    return { wide, narrow, width, link };
  });
  assert.equal(gridLayout.wide[0], gridLayout.wide[1]);
  assert.ok(gridLayout.narrow[1] > gridLayout.narrow[0]);
  assert.ok(gridLayout.width <= 240);
  assert.equal(gridLayout.link, 'child.html');
  await checkCopiedImages(page);

  server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = join(output, path === '/' ? 'index.html' : path);
      response.setHeader(
        'Content-Type',
        path.endsWith('.png') ? 'image/png' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html',
      );
      response.end(await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${origin}/`);
  const repository = await page.$eval('.sidebar-heading .documentation-repository', (link) => ({
    href: link.href,
    target: link.target,
    belowTitle: link.getBoundingClientRect().top >= link.previousElementSibling.getBoundingClientRect().bottom,
  }));
  assert.deepEqual(repository, {
    href: 'https://gitlab.example/group/project',
    target: '_blank',
    belowTitle: true,
  });
  const loadedPage = async (id) => {
    await page.waitForFunction(
      (id) =>
        document.querySelector(`.page-link[data-page-id="${id}"]`)?.classList.contains('active') &&
        location.hash === `#page/${id}`,
      {},
      id,
    );
    const frame = page.frames().find((item) => item.url().endsWith(`/pages/${id}.html`));
    assert.ok(frame, `Loaded ${id} document`);
    await frame.waitForSelector('h1');
    return frame;
  };
  let frame = await loadedPage('first');
  assert.ok(await page.$eval('link[rel="icon"]', (link) => link.href.startsWith('data:image/svg+xml,')));
  assert.equal(await page.$eval('.documentation-logo', (logo) => logo.getAttribute('href')), '/');
  assert.equal(await frame.$('[rel="prev"]'), null);
  await checkCopiedImages(frame);
  await frame.click('[rel="next"]');
  frame = await loadedPage('child');
  assert.equal(await frame.$eval('[rel="prev"]', (link) => link.getAttribute('href')), 'first.html');
  await frame.click('[rel="next"]');
  frame = await loadedPage('last');
  assert.equal(await frame.$('[rel="next"]'), null);
  await frame.click('[rel="prev"]');
  frame = await loadedPage('child');
  await frame.click('[rel="prev"]');
  await loadedPage('first');

  await page.click('.navigation-toggle');
  assert.deepEqual(
    await page.evaluate(() => ({
      hidden: document.querySelector('.sidebar').hidden,
      display: getComputedStyle(document.querySelector('.sidebar')).display,
      contentX: document.querySelector('.content').getBoundingClientRect().x,
      expanded: document.querySelector('.navigation-toggle').getAttribute('aria-expanded'),
      persisted: localStorage.getItem('slash-doc-navigation-hidden'),
    })),
    { hidden: true, display: 'none', contentX: 0, expanded: 'false', persisted: 'true' },
  );
  await page.reload();
  await loadedPage('first');
  assert.equal(await page.$eval('.sidebar', (sidebar) => sidebar.hidden), true);
  await page.click('.navigation-toggle');
  assert.equal(await page.$eval('.sidebar', (sidebar) => sidebar.hidden), false);
  assert.ok((await page.$eval('.content', (content) => content.getBoundingClientRect().x)) > 180);
  await page.click('.documentation-logo');
  await loadedPage('first');

  // Check that settings switches persist through the actual sidebar event handlers.
  await page.setContent(
    '<section id="settings-section"><slash-switch id="show-copy-html-button" checked></slash-switch><slash-switch id="show-page-navigation"></slash-switch><input id="favicon-data" type="hidden"><input id="favicon-upload" type="file"><img id="favicon-preview"><button id="favicon-reset">Reset</button><span id="favicon-status"></span></section>',
  );
  await page.evaluate(() => {
    window.acquireVsCodeApi = () => ({
      getState: () => ({}),
      setState() {},
      postMessage: (message) => {
        window.savedSettings = message;
      },
    });
  });
  await page.addScriptTag({ path: resolve('dist/sidebar.js') });
  await page.evaluate(() => {
    const copy = document.querySelector('#show-copy-html-button');
    copy.checked = false;
    copy.dispatchEvent(new Event('change'));
    const pagination = document.querySelector('#show-page-navigation');
    pagination.checked = true;
    pagination.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => window.savedSettings?.type === 'updateSettings');
  const settings = await page.evaluate(() => window.savedSettings.settings.exportOptions);
  assert.equal(settings.showCopyHtmlButton, false);
  assert.equal(settings.showPageNavigation, true);
  const faviconPath = join(root, 'favicon.png');
  await writeFile(faviconPath, Buffer.from(png, 'base64'));
  const upload = await page.$('#favicon-upload');
  await upload.uploadFile(faviconPath);
  await page.waitForFunction((value) => window.savedSettings?.settings.exportOptions.favicon === value, {}, imageUrl);
  assert.equal(await page.$eval('#favicon-preview', (preview) => preview.getAttribute('src')), imageUrl);
  await page.click('#favicon-reset');
  await page.waitForFunction(() => window.savedSettings?.settings.exportOptions.favicon === '');
  assert.ok(await page.$eval('#favicon-preview', (preview) => preview.src.startsWith('data:image/svg+xml,')));
  await upload.uploadFile(faviconPath);
  await page.waitForFunction((value) => window.savedSettings?.settings.exportOptions.favicon === value, {}, imageUrl);
  const uploadedSettings = await page.evaluate(() => window.savedSettings.settings);
  uploadedSettings.exportOptions.separateFiles = true;
  await writeFile(join(root, '.slash-doc', 'sdsettings.json'), JSON.stringify(uploadedSettings));
  await execFileAsync(process.execPath, [resolve('dist/slash-doc-compile.js'), root, '--output', output]);
  await page.goto(`${origin}/`);
  frame = await loadedPage('first');
  assert.equal(await page.$eval('link[rel="icon"]', (link) => link.getAttribute('href')), imageUrl);
  assert.equal(await frame.$eval('link[rel="icon"]', (link) => link.getAttribute('href')), imageUrl);
  assert.deepEqual(errors, []);
  console.log(
    'Compiled site smoke passed: offline/HTTP clipboard images, nested SVG, pagination/hash, logo, navigation visibility and saved settings.',
  );
} finally {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
  await rm(root, { recursive: true, force: true });
}
