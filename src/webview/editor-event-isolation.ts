export type EditorEvent = Pick<Event, 'preventDefault' | 'stopImmediatePropagation'>;

export function isolateEditorEvent(event: EditorEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function findClipboardImage(clipboard: DataTransfer | null): File | undefined {
  const file = Array.from(clipboard?.files ?? []).find((item) => item.type.startsWith('image/'));
  if (file) return file;

  return (
    Array.from(clipboard?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile() ?? undefined
  );
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
