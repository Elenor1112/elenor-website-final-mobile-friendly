import { z } from 'zod';

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

// The read-write token is `vercel_blob_rw_<storeId>_<secret>` and the store's
// public host is `<storeId>.public.blob.vercel-storage.com`. When the token is
// visible (server side) only that one store is accepted, not any Blob store.
function ownBlobHost(): string | null {
  const m = /^vercel_blob_rw_([a-z0-9]+)_/i.exec(process.env.BLOB_READ_WRITE_TOKEN ?? '');
  return m ? `${m[1].toLowerCase()}${BLOB_HOST_SUFFIX}` : null;
}

// Browsers treat a leading "/\" like "//" (protocol-relative → another host),
// and strip tabs/newlines before parsing, so both must be rejected.
function isInternalPath(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

/** True for links that cannot execute script: same-site paths, #anchors,
 *  http(s), mailto and tel. Rejects javascript:, data:, vbscript:, etc. */
export function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (v === '' || v.startsWith('#')) return true;
  if (v.startsWith('/')) return isInternalPath(v);
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

/** Same-site redirect target, or `fallback` for anything that could leave the origin. */
export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  return value && isInternalPath(value) ? value : fallback;
}

/** Link field: empty, relative, #anchor, http(s), mailto or tel. */
export const safeHref = () =>
  z.string().trim().max(2000).refine(isSafeHref, 'Enter a valid link (https://…, /path, mailto: or tel:).');

/** Absolute https URL, or empty. */
export const httpsUrlOrEmpty = () =>
  z
    .string()
    .trim()
    .max(2000)
    .refine((v) => {
      if (v === '') return true;
      try {
        return new URL(v).protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Enter a valid https:// URL.');

/** A file in this project's Vercel Blob store. */
export const blobUrl = () =>
  z
    .string()
    .url()
    .refine((v) => {
      try {
        const u = new URL(v);
        const own = ownBlobHost();
        return u.protocol === 'https:' && (own ? u.hostname === own : u.hostname.endsWith(BLOB_HOST_SUFFIX));
      } catch {
        return false;
      }
    }, 'Media must be uploaded to the media library.');
