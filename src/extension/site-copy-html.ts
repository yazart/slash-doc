import type { ExtractedImage } from '../shared/embedded-images';
import { escapeScriptJson } from './utils';

/** Include only the clipboard payload so a local file can be copied without fetch/file CORS. */
export function attachClipboardImages(html: string, images: ExtractedImage[]): string {
  if (!images.length || !html.includes('<script data-slash-doc-copy-script>')) return html;
  const cache = new Map<string, string>();
  const encode = (image: ExtractedImage, ancestors = new Set<string>()): string => {
    const cached = cache.get(image.fileName);
    if (cached) return cached;
    const mime = image.mimeType ?? 'image/png';
    let bytes = Buffer.from(image.data);
    if (mime === 'image/svg+xml') {
      const visited = new Set([...ancestors, image.fileName]);
      let svg = bytes.toString('utf8');
      for (const dependency of images) {
        if (!visited.has(dependency.fileName) && svg.includes(dependency.fileName)) {
          svg = svg.replaceAll(dependency.fileName, () => encode(dependency, visited));
        }
      }
      bytes = Buffer.from(svg, 'utf8');
    }
    const value = `data:${mime};base64,${bytes.toString('base64')}`;
    cache.set(image.fileName, value);
    return value;
  };
  const assets = Object.fromEntries(
    images.map((image) => {
      const value = encode(image);
      const comma = value.indexOf(',');
      return [image.fileName, { type: value.slice(5, comma - 7), data: value.slice(comma + 1) }];
    }),
  );
  const manifest = `<script type="application/json" data-slash-doc-copy-images>${escapeScriptJson(assets)}</script>`;
  return html.replace('</body>', `${manifest}\n</body>`);
}

export function renderCopyHtmlControl(): string {
  return `<button class="slash-doc-copy-html" type="button" data-slash-doc-copy-control aria-label="Скопировать HTML страницы" title="Скопировать HTML страницы">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
    <span>Скопировать HTML</span>
  </button>
  <script data-slash-doc-copy-script>${getCopyPageScript()}</script>`;
}

function getCopyPageScript(): string {
  return `(() => {
    const button = document.querySelector('[data-slash-doc-copy-control]');
    if (!button) return;
    const assets = () => JSON.parse(document.querySelector('[data-slash-doc-copy-images]')?.textContent || '{}');
    const embedImages = (clone) => {
      const images = assets();
      const replace = (reference) => {
        const name = reference.replace(/^\\.\\//, '');
        const image = Object.hasOwn(images, name) ? images[name] : undefined;
        return image ? 'data:' + image.type + ';base64,' + image.data : reference;
      };
      const css = (value) => value.replace(/url\\(\\s*(['"]?)([^)'"\\s]+)\\1\\s*\\)/gi, (_match, _quote, reference) => 'url("' + replace(reference) + '")');
      clone.querySelectorAll('*').forEach((element) => {
        ['src', 'href', 'xlink:href', 'poster'].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (value) element.setAttribute(attribute, replace(value));
        });
        const srcset = element.getAttribute('srcset');
        if (srcset) element.setAttribute('srcset', srcset.replace(/([^,\\s]+)(?=\\s|,|$)/g, replace));
        if (element.hasAttribute('style')) element.setAttribute('style', css(element.getAttribute('style')));
        if (element.tagName === 'STYLE') element.textContent = css(element.textContent);
      });
    };
    const writeClipboard = async (value) => {
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(value); return true; } catch {}
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(textarea);
      textarea.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      textarea.remove();
      return copied;
    };
    button.addEventListener('click', async () => {
      let copied = false;
      try {
        const clone = document.documentElement.cloneNode(true);
        embedImages(clone);
        clone.removeAttribute('data-slash-doc-theme');
        clone.querySelector('body')?.removeAttribute('data-slash-doc-copy-enabled');
        clone.querySelectorAll('[data-slash-doc-copy-control],script[data-slash-doc-copy-script],script[data-slash-doc-copy-images],[data-slash-doc-page-navigation]').forEach((item) => item.remove());
        copied = await writeClipboard('<!DOCTYPE html>\\n' + clone.outerHTML);
      } catch {}
      const label = button.querySelector('span');
      if (label) label.textContent = copied ? 'Скопировано' : 'Не удалось скопировать';
      button.classList.toggle('copied', copied);
      window.setTimeout(() => {
        if (label) label.textContent = 'Скопировать HTML';
        button.classList.remove('copied');
      }, 1800);
    });
  })();`;
}
