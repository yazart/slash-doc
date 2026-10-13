import { DEFAULT_FAVICON, normalizeFavicon } from '../shared/favicon';

export function bindFaviconSettings(onChange: () => void): void {
  const input = document.querySelector<HTMLInputElement>('#favicon-upload');
  const value = document.querySelector<HTMLInputElement>('#favicon-data');
  const preview = document.querySelector<HTMLImageElement>('#favicon-preview');
  const status = document.querySelector<HTMLElement>('#favicon-status');
  if (!input || !value || !preview) return;
  let version = 0;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const current = ++version;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (current !== version) return;
      const source = String(reader.result).replace(/^data:application\/octet-stream;/, 'data:image/x-icon;');
      const favicon = normalizeFavicon(source);
      if (!favicon) {
        if (status) status.textContent = 'Выберите PNG, JPEG, GIF, WebP, SVG или ICO.';
        return;
      }
      value.value = favicon;
      preview.src = favicon;
      if (status) status.textContent = file.name;
      onChange();
    });
    reader.addEventListener('error', () => {
      if (current === version && status) status.textContent = 'Не удалось прочитать favicon.';
    });
    reader.readAsDataURL(file);
  });
  document.querySelector('#favicon-reset')?.addEventListener('click', () => {
    version++;
    value.value = '';
    input.value = '';
    preview.src = DEFAULT_FAVICON;
    if (status) status.textContent = '';
    onChange();
  });
}
