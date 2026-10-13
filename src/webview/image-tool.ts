import type { BlockToolConstructorOptions } from './block-editor-types';
import { iconButton } from './block-editor-view';
import { LUCIDE_ICONS } from './lucide-icons';
import { sanitizeTableCellHtml } from '../shared/table-cell-html';

const IMAGE_URL = /^(?:https?:|data:image\/|blob:)/i;

export default class ImageTool {
  private data: Record<string, any>;
  private readonly options: BlockToolConstructorOptions;
  private root?: HTMLElement;
  private image?: HTMLImageElement;
  private zone?: HTMLElement;
  private placeholder?: HTMLElement;
  private file?: HTMLInputElement;
  private replace?: HTMLButtonElement;
  private loading = false;
  private destroyed = false;

  static get toolbox() {
    return { title: 'Изображение', icon: LUCIDE_ICONS.image };
  }
  constructor(options: BlockToolConstructorOptions) {
    this.options = options;
    this.data = structuredClone(options.data);
  }
  render(): HTMLElement {
    const root = document.createElement('figure');
    root.className = 'image-tool';
    this.root = root;
    const image = document.createElement('img');
    image.className = 'image-tool__image';
    image.alt = '';
    image.draggable = false;
    this.image = image;
    if (this.options.readOnly) {
      root.append(image);
    } else {
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.hidden = true;
      file.setAttribute('aria-label', 'Выбрать изображение');
      file.addEventListener('change', () => {
        const selected = file.files?.[0];
        if (selected) void this.upload(selected);
        file.value = '';
      });
      this.file = file;
      const zone = document.createElement('div');
      zone.className = 'image-tool__dropzone';
      zone.tabIndex = 0;
      zone.setAttribute('role', 'button');
      zone.setAttribute('aria-label', 'Загрузить изображение');
      zone.addEventListener('click', () => this.chooseFile());
      zone.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        this.chooseFile();
      });
      const placeholder = document.createElement('div');
      placeholder.className = 'image-tool__placeholder';
      zone.append(image, placeholder);
      root.append(zone);
      this.zone = zone;
      this.placeholder = placeholder;
      this.installDrop(zone);
    }
    const caption = document.createElement('figcaption');
    caption.className = 'image-tool__caption';
    caption.contentEditable = String(!this.options.readOnly);
    caption.dataset.placeholder = 'Подпись';
    caption.innerHTML = sanitizeTableCellHtml(this.data.caption ?? '');
    caption.addEventListener('input', () => {
      this.data.caption = caption.innerHTML;
    });
    root.append(caption);
    this.refresh();
    return root;
  }
  renderHeaderControls(): HTMLElement {
    const controls = document.createElement('span');
    controls.className = 'image-tool__header-controls';
    if (this.options.readOnly) return controls;
    this.replace = iconButton('Заменить изображение', LUCIDE_ICONS.image);
    this.replace.addEventListener('click', () => this.chooseFile());
    controls.append(this.replace);
    if (this.file) controls.append(this.file);
    for (const [key, label] of [
      ['withBorder', 'Рамка'],
      ['withBackground', 'Фон'],
      ['stretched', 'Растянуть'],
    ]) {
      const wrapper = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = this.data[key] === true;
      input.addEventListener('change', () => {
        this.data[key] = input.checked;
        this.refresh();
        this.options.block.dispatchChange();
      });
      wrapper.append(input, label);
      controls.append(wrapper);
    }
    return controls;
  }
  save() {
    return structuredClone(this.data);
  }
  destroy(): void {
    this.destroyed = true;
  }
  private chooseFile(): void {
    if (!this.destroyed && !this.options.readOnly && !this.loading) this.file?.click();
  }
  private refresh(): void {
    const url = this.data.file?.url ?? '';
    const hasImage = typeof url === 'string' && IMAGE_URL.test(url);
    if (this.image) {
      if (hasImage) this.image.src = url;
      else this.image.removeAttribute('src');
      this.image.hidden = !hasImage;
    }
    for (const key of ['withBorder', 'withBackground', 'stretched']) {
      this.root?.classList.toggle(`image-tool--${key}`, this.data[key] === true);
    }
    this.zone?.classList.toggle('image-tool__dropzone--filled', hasImage);
    this.zone?.setAttribute('aria-busy', String(this.loading));
    if (this.placeholder) {
      this.placeholder.hidden = hasImage;
      this.placeholder.innerHTML = `${LUCIDE_ICONS.image}<span>${this.loading ? 'Загрузка изображения…' : 'Перетащите изображение сюда или нажмите для выбора файла'}</span>`;
    }
    if (this.file) this.file.disabled = this.loading;
    if (this.replace) this.replace.disabled = this.loading;
  }
  private installDrop(zone: HTMLElement): void {
    let depth = 0;
    const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes('Files');
    const reset = () => {
      depth = 0;
      zone.classList.remove('image-tool__dropzone--active');
    };
    zone.addEventListener('dragenter', (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      depth += 1;
      zone.classList.add('image-tool__dropzone--active');
    });
    zone.addEventListener('dragover', (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = this.loading ? 'none' : 'copy';
    });
    zone.addEventListener('dragleave', (event) => {
      if (!isFileDrag(event)) return;
      event.stopPropagation();
      depth -= 1;
      if (depth <= 0) reset();
    });
    zone.addEventListener('drop', (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      reset();
      const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith('image/'));
      if (file) void this.upload(file);
      else this.options.api.notifier.show({ message: 'Выберите файл изображения' });
    });
    zone.addEventListener('dragend', reset);
  }
  private async upload(file: File): Promise<void> {
    if (this.destroyed || this.options.readOnly || this.loading) return;
    if (!file.type.startsWith('image/')) {
      this.options.api.notifier.show({ message: 'Выберите файл изображения' });
      return;
    }
    this.loading = true;
    this.refresh();
    try {
      const uploader = this.options.config?.uploader;
      const result = uploader?.uploadByFile
        ? await uploader.uploadByFile(file)
        : { success: 1, file: { url: await readImageFile(file), name: file.name } };
      if (result.success !== 1 || typeof result.file?.url !== 'string' || !IMAGE_URL.test(result.file.url)) {
        throw new Error('Не удалось загрузить изображение');
      }
      if (this.destroyed || !this.root?.isConnected) return;
      this.data.file = result.file;
      this.options.block.dispatchChange();
    } catch (error) {
      if (!this.destroyed) {
        this.options.api.notifier.show({
          message: error instanceof Error ? error.message : 'Не удалось загрузить изображение',
        });
      }
    } finally {
      this.loading = false;
      this.refresh();
    }
  }
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });
}
