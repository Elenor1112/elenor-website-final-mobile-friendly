'use server';

import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { postCategories, posts, postTags, tags } from '@/db/schema';
import type { RichTextDoc } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { revalidatePosts } from '@/lib/revalidate';
import { postInputSchema, type PostInput } from '@/lib/validation/content';
import { richTextToPlainText } from '@/lib/richtext/render';
import { logAudit } from './audit';
import type { ActionResult } from './services';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const WORDS_PER_MINUTE = 200;

export async function savePost(input: PostInput): Promise<ActionResult> {
  const user = await requireUser('content:write');
  const parsed = postInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { id, tags: tagNames, seo, publishedAt, ...data } = parsed.data;

  const clash = await db.query.posts.findFirst({
    where: id ? and(eq(posts.slug, data.slug), ne(posts.id, id)) : eq(posts.slug, data.slug),
  });
  if (clash) return { ok: false, error: `Slug “${data.slug}” is already in use.` };

  if (data.status === 'scheduled' && !publishedAt) {
    return { ok: false, error: 'Pick a publish date & time to schedule this post.' };
  }

  const words = richTextToPlainText(data.body as RichTextDoc).split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));

  const values = {
    ...data,
    body: data.body as RichTextDoc,
    // Publishing without an explicit date stamps "now"; scheduled keeps the
    // chosen future time; drafts keep whatever was there.
    publishedAt: publishedAt
      ? new Date(publishedAt)
      : data.status === 'published'
        ? new Date()
        : null,
    readingMinutes,
    ...seo,
    updatedAt: new Date(),
  };

  let postId = id;
  let previousSlug: string | undefined;
  if (id) {
    const existing = await db.query.posts.findFirst({ where: eq(posts.id, id) });
    if (!existing) return { ok: false, error: 'Post not found' };
    previousSlug = existing.slug;
    // Preserve the original publish date on already-published posts unless a
    // new one was chosen explicitly.
    if (!publishedAt && existing.publishedAt && values.status !== 'draft') {
      values.publishedAt = existing.publishedAt;
    }
    await db.update(posts).set(values).where(eq(posts.id, id));
  } else {
    const [row] = await db.insert(posts).values(values).returning({ id: posts.id });
    postId = row.id;
  }

  // Tags: upsert by slug, then replace the join set.
  await db.delete(postTags).where(eq(postTags.postId, postId!));
  const cleanNames = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
  if (cleanNames.length > 0) {
    await db
      .insert(tags)
      .values(cleanNames.map((name) => ({ slug: slugify(name), name })))
      .onConflictDoNothing({ target: tags.slug });
    const rows = await db.query.tags.findMany();
    const bySlug = new Map(rows.map((t) => [t.slug, t.id]));
    const ids = cleanNames.map((n) => bySlug.get(slugify(n))).filter((x): x is string => Boolean(x));
    if (ids.length > 0) {
      await db.insert(postTags).values(ids.map((tagId) => ({ postId: postId!, tagId })));
    }
  }

  revalidatePosts(data.slug);
  if (previousSlug && previousSlug !== data.slug) revalidatePosts(previousSlug);
  await logAudit(user.id, id ? 'update' : 'create', 'post', postId!, data.title);
  return { ok: true, id: postId! };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const user = await requireUser('content:write');
  const existing = await db.query.posts.findFirst({ where: eq(posts.id, z.string().uuid().parse(id)) });
  if (!existing) return { ok: false, error: 'Post not found' };
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePosts(existing.slug);
  await logAudit(user.id, 'delete', 'post', id, existing.title, existing);
  return { ok: true, id };
}

export async function setPostStatus(
  id: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionResult> {
  const user = await requireUser('content:write');
  // Arguments arrive straight from the client; TypeScript types are not enforced at runtime.
  id = z.string().uuid().parse(id);
  status = z.enum(['draft', 'published', 'archived']).parse(status);
  const existing = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!existing) return { ok: false, error: 'Post not found' };
  await db
    .update(posts)
    .set({
      status,
      publishedAt: status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));
  revalidatePosts(existing.slug);
  await logAudit(user.id, status === 'published' ? 'publish' : 'update', 'post', id, existing.title);
  return { ok: true, id };
}

export async function getPostForEdit(id: string) {
  await requireUser();
  const row = await db.query.posts.findFirst({
    where: eq(posts.id, z.string().uuid().parse(id)),
    with: { coverImage: true, ogImage: true, category: true, tags: { with: { tag: true } } } as never,
  });
  return row ?? null;
}

/* -------------------------------- categories -------------------------------- */

export async function savePostCategory(name: string, id?: string): Promise<ActionResult> {
  await requireUser('content:write');
  const clean = z.string().min(1).max(120).parse(name.trim());
  if (id) {
    await db.update(postCategories).set({ name: clean }).where(eq(postCategories.id, id));
    revalidatePosts();
    return { ok: true, id };
  }
  const [row] = await db
    .insert(postCategories)
    .values({ slug: slugify(clean), name: clean })
    .onConflictDoNothing({ target: postCategories.slug })
    .returning({ id: postCategories.id });
  revalidatePosts();
  return row ? { ok: true, id: row.id } : { ok: false, error: 'Category already exists' };
}

export async function deletePostCategory(id: string): Promise<{ ok: boolean }> {
  await requireUser('content:write');
  await db.delete(postCategories).where(eq(postCategories.id, z.string().uuid().parse(id)));
  revalidatePosts();
  return { ok: true };
}
