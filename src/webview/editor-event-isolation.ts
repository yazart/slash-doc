export type EditorEvent = Pick<Event, 'preventDefault' | 'stopImmediatePropagation'>;

export function isolateEditorEvent(event: EditorEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function findClipboardImage(clipboard: DataTransfer | null): File | undefined {
  return findClipboardImages(clipboard)[0];
}

export function findClipboardImages(clipboard: DataTransfer | null): File[] {
  const files = Array.from(clipboard?.files ?? []).filter((item) => item.type.startsWith('image/'));
  if (files.length) return files;
  return Array.from(clipboard?.items ?? []).flatMap((item) => {
    const file = item.kind === 'file' && item.type.startsWith('image/') ? item.getAsFile() : null;
    return file ? [file] : [];
  });
}

export function consumeClipboardImage(
  event: EditorEvent & Pick<ClipboardEvent, 'clipboardData'>,
  loadImage: (file: File) => void,
): boolean {
  const file = findClipboardImage(event.clipboardData);
  if (!file) return false;
  isolateEditorEvent(event);
  loadImage(file);
  return true;
}
