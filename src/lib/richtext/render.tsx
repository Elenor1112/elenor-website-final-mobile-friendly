import { generateHTML } from '@tiptap/html/server';
import type { RichTextDoc } from '@/db/schema';
import { richTextExtensions } from './extensions';
import { sanitizeRichText } from './sanitize';

export function richTextToHtml(doc: RichTextDoc | null | undefined): string {
  // Sanitised at render too, so payloads saved before sanitising existed are inert.
  const clean = sanitizeRichText(doc);
  if (!clean || !Array.isArray(clean.content) || clean.content.length === 0) return '';
  try {
    return generateHTML(clean as never, richTextExtensions);
  } catch {
    return '';
  }
}

/** Extracts plain text (for reading-time estimates and search). */
export function richTextToPlainText(doc: RichTextDoc | null | undefined): string {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { text?: string; content?: unknown[] };
    if (typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return parts.join(' ');
}

/** Server component rendering stored Tiptap JSON. Styled via .rich-text. */
export function RichText({
  doc,
  className = '',
}: {
  doc: RichTextDoc | null | undefined;
  className?: string;
}) {
  const html = richTextToHtml(doc);
  if (!html) return null;
  return (
    <div
      className={`rich-text ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
