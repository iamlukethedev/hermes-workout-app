export type Photo = {
  mediaType: 'image/jpeg';
  /** Base64 payload without the `data:` prefix. */
  data: string;
  /** Object URL for thumbnails. Release it with `releasePhoto` when the photo is discarded. */
  preview: string;
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_SIDE = 1280;
const QUALITY = 0.85;

async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path for formats createImageBitmap rejects.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', QUALITY),
  );
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales to at most 1280px on the longest side and re-encodes as JPEG. Drawing through a
 * canvas drops all EXIF data, including GPS location and camera details, so none of it is sent.
 */
export async function preparePhoto(file: File): Promise<Photo> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image.`);
  if (file.size > MAX_INPUT_BYTES)
    throw new Error(`"${file.name}" is larger than 25 MB. Pick a smaller photo.`);
  try {
    const img = await decode(file);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
      const blob = await toBlob(canvas);
      return {
        mediaType: 'image/jpeg',
        data: await toBase64(blob),
        preview: URL.createObjectURL(blob),
      };
    } finally {
      img.close();
    }
  } catch {
    throw new Error(`Couldn't read "${file.name}". Try a JPEG or PNG photo.`);
  }
}

export function releasePhoto(photo: Photo) {
  URL.revokeObjectURL(photo.preview);
}
