'use client';

import { upload } from '@vercel/blob/client';
import { registerUpload, type MediaItem } from '@/server/actions/media';
import { MODEL_EXTENSIONS, isModelFilename } from '@/db/schema/media';

const MODEL_MAX_BYTES = 100 * 1024 * 1024;

// Client-side compression: re-encode large raster images to WebP on a canvas
// before uploading. Keeps the Blob free tier comfortable and pages fast
// without routing bytes through a server function.
const MAX_DIMENSION = 2560;
const WEBP_QUALITY = 0.82;
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

async function compressImage(
  file: File,
): Promise<{ blob: Blob; filename: string; width: number | null; height: number | null }> {
  if (!COMPRESSIBLE.includes(file.type)) {
    // SVG/GIF/AVIF pass through untouched; try to read dimensions anyway.
    const dims = await readDimensions(file).catch(() => null);
    return { blob: file, filename: file.name, width: dims?.width ?? null, height: dims?.height ?? null };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    );
    if (!blob) throw new Error('encode failed');

    // Only keep the re-encode when it actually shrank the file.
    if (blob.size >= file.size) {
      return { blob: file, filename: file.name, width: bitmap.width || width, height: bitmap.height || height };
    }
    const filename = file.name.replace(/\.[a-z0-9]+$/i, '') + '.webp';
    return { blob, filename, width, height };
  } catch {
    const dims = await readDimensions(file).catch(() => null);
    return { blob: file, filename: file.name, width: dims?.width ?? null, height: dims?.height ?? null };
  }
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable image'));
    };
    img.src = url;
  });
}

/**
 * Compress → direct upload to Blob → register a media row.
 *
 * 3D models skip compression entirely (canvas re-encoding would corrupt them)
 * and upload byte-for-byte under the larger model size cap. `onProgress`
 * reports 0–100 for the transfer itself.
 */
export async function uploadFile(
  file: File,
  folderId: string | null,
  onProgress?: (percent: number) => void,
): Promise<MediaItem> {
  const isModel = isModelFilename(file.name);

  if (isModel && file.size > MODEL_MAX_BYTES) {
    throw new Error(
      `Model is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MODEL_MAX_BYTES / 1024 / 1024}MB.`,
    );
  }

  const { blob, filename, width, height } = isModel
    ? { blob: file as Blob, filename: file.name, width: null, height: null }
    : await compressImage(file);

  const result = await upload(filename, blob, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
  });

  const registered = await registerUpload({
    url: result.url,
    filename,
    // .fbx/.obj have no browser-supplied type; record a stable one so the
    // library can tell models from images after the fact.
    mimeType: blob.type || file.type || (isModel ? 'model/3d' : ''),
    sizeBytes: blob.size,
    width,
    height,
    folderId,
  });
  return registered.item;
}

/** File-input `accept` value for image pickers; mirrors the upload route's
 *  allowlist (no SVG). */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';

/** File-input `accept` value for pickers that take 3D models. */
export const MODEL_ACCEPT = MODEL_EXTENSIONS.join(',');
