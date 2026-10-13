import { getSchema } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import type { RichTextDoc } from '@/db/schema';
import { isSafeHref } from '@/lib/validation/url';
import { richTextExtensions } from './extensions';

// Rich-text bodies arrive as client-supplied JSON and are rendered to raw
// HTML on the public site, which shares an origin with /admin. Round-tripping
// through the editor schema keeps only known nodes, marks and attributes
// (dropping smuggled keys such as `__proto__`); the walk below then removes
// links and images whose URLs could run script.

const schema = getSchema(richTextExtensions);

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: JsonNode[];
  [key: string]: unknown;
};

function isSafeImageSrc(src: unknown): boolean {
  if (typeof src !== 'string') return false;
  const v = src.trim();
  if (v.startsWith('/')) return isSafeHref(v);
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

function clean(node: JsonNode): JsonNode | null {
  if (node.type === 'image' && !isSafeImageSrc(node.attrs?.src)) return null;
  const out: JsonNode = { ...node };
  if (node.marks) {
    out.marks = node.marks.filter(
      (m) => m.type !== 'link' || (typeof m.attrs?.href === 'string' && isSafeHref(m.attrs.href)),
    );
    if (out.marks.length === 0) delete out.marks;
  }
  if (node.content) {
    out.content = node.content.map(clean).filter((n): n is JsonNode => n !== null);
  }
  return out;
}

/** Returns a doc containing only schema-valid content with safe URLs, or
 *  null when the input is not a valid document at all. */
export function sanitizeRichText(doc: RichTextDoc | null | undefined): RichTextDoc | null {
  if (!doc || typeof doc !== 'object') return null;
  try {
    const json = PMNode.fromJSON(schema, doc).toJSON() as JsonNode;
    if (json.type !== 'doc') return null;
    return clean(json) as RichTextDoc;
  } catch {
    return null;
  }
}
