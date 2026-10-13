import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { sanitizeRichText } from '@/lib/richtext/sanitize';
import { richTextToHtml } from '@/lib/richtext/render';
import { blobUrl } from '@/lib/validation/url';
import { postInputSchema, seoInputSchema } from '@/lib/validation/content';
import { philosophySchema } from '@/lib/validation/sections';
import type { RichTextDoc } from '@/db/schema';

// Payloads an EDITOR could post straight to the server action, bypassing the editor UI.
const doc = (content: unknown[]) => ({ type: 'doc', content }) as RichTextDoc;
const para = (...content: unknown[]) => ({ type: 'paragraph', content });

describe('sanitizeRichText', () => {
  it('drops __proto__ and unknown attributes', () => {
    const payload = JSON.parse(
      '{"type":"doc","content":[{"type":"image","attrs":{"src":"/a.png","__proto__":{"onerror":"alert(1)"},"onload":"alert(2)"}}]}',
    );
    const html = richTextToHtml(payload);
    assert.match(html, /<img/);
    assert.doesNotMatch(html, /onerror|onload|alert/);
  });

  it('removes javascript: and data: links but keeps the text', () => {
    for (const href of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>', '//evil.com']) {
      const html = richTextToHtml(
        doc([para({ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href } }] })]),
      );
      assert.equal(html.includes('href'), false, href);
      assert.match(html, /click/);
    }
  });

  it('keeps safe links', () => {
    const html = richTextToHtml(
      doc([para({ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] })]),
    );
    assert.match(html, /href="https:\/\/example\.com"/);
  });

  it('removes images with script URLs', () => {
    const out = sanitizeRichText(doc([{ type: 'image', attrs: { src: 'javascript:alert(1)' } }]));
    assert.deepEqual(out?.content, []);
  });

  it('rejects unknown node types and escapes text', () => {
    assert.equal(sanitizeRichText(doc([{ type: 'script', text: 'alert(1)' }])), null);
    const html = richTextToHtml(doc([para({ type: 'text', text: '</p><script>alert(1)</script>' })]));
    assert.doesNotMatch(html, /<script/);
  });

  it('sanitises on save through the post schema', () => {
    const parsed = postInputSchema.parse({
      slug: 'a',
      title: 'a',
      authorName: 'a',
      body: doc([para({ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] })]),
    });
    assert.equal(JSON.stringify(parsed.body).includes('javascript'), false);
  });
});

describe('link fields', () => {
  it('refuses javascript: in the philosophy eyebrow link', () => {
    assert.equal(philosophySchema.safeParse({ eyebrowHref: 'javascript:alert(1)' }).success, false);
    assert.equal(philosophySchema.parse({ eyebrowHref: '/about' }).eyebrowHref, '/about');
  });

  it('accepts only /path or http(s) canonical URLs', () => {
    assert.equal(seoInputSchema.parse({ canonicalUrl: '/blog/x' }).canonicalUrl, '/blog/x');
    assert.equal(seoInputSchema.parse({ canonicalUrl: '' }).canonicalUrl, null);
    for (const bad of ['javascript:alert(1)', 'mailto:a@b.c', '//evil.com', '#x']) {
      assert.equal(seoInputSchema.safeParse({ canonicalUrl: bad }).success, false, bad);
    }
  });
});

describe('blobUrl', () => {
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = saved;
  });

  it('accepts only this project’s store when the token is set', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_AbC123_secret';
    assert.equal(blobUrl().safeParse('https://abc123.public.blob.vercel-storage.com/x.png').success, true);
    assert.equal(blobUrl().safeParse('https://attacker1.public.blob.vercel-storage.com/x.png').success, false);
    assert.equal(blobUrl().safeParse('http://abc123.public.blob.vercel-storage.com/x.png').success, false);
  });

  it('falls back to any Blob store without a token', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal(blobUrl().safeParse('https://any.public.blob.vercel-storage.com/x.png').success, true);
    assert.equal(blobUrl().safeParse('https://evil.com/x.png').success, false);
  });
});
