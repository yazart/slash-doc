export type ExtractedImage = {
  fileName: string;
  data: Uint8Array;
};

export function extractEmbeddedImages(
  content: string,
  filePrefix = 'image',
): { content: string; images: ExtractedImage[] } {
  const images: ExtractedImage[] = [];
  const names = new Map<string, string>();
  const transformed = content.replaceAll(
    /data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/=]+)/gi,
    (source: string, mimeSubtype: string, payload: string) => {
      const existing = names.get(source);
      if (existing) return existing;
      const fileName = `${filePrefix}-${images.length + 1}.${imageExtension(mimeSubtype)}`;
      names.set(source, fileName);
      images.push({ fileName, data: Buffer.from(payload, 'base64') });
      return fileName;
    },
  );
  return { content: transformed, images };
}

function imageExtension(mimeSubtype: string): string {
  const normalized = mimeSubtype.toLowerCase();
  if (normalized === 'svg+xml') return 'svg';
  if (normalized === 'jpeg') return 'jpg';
  if (normalized === 'x-icon' || normalized === 'vnd.microsoft.icon') return 'ico';
  return /^[a-z0-9]+$/.test(normalized) ? normalized : 'img';
}
