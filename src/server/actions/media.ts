'use server';

import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { z } from 'zod';
import { db } from '@/db';
import {
  caseStudies,
  caseStudyGalleryImages,
  media,
  mediaFolders,
  pages,
  pageSections,
  posts,
  serviceImages,
  services,
  settings,
  testimonials,
} from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { revalidateEverything, revalidateMedia } from '@/lib/revalidate';
import { blobUrl } from '@/lib/validation/url';

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  mimeType: string | null;
  storage: 'local' | 'blob';
  folderId: string | null;
  createdAt: string;
};

const toItem = (m: typeof media.$inferSelect): MediaItem => ({
  id: m.id,
  url: m.url,
  filename: m.filename,
  alt: m.alt,
  caption: m.caption,
  width: m.width,
  height: m.height,
  sizeBytes: m.sizeBytes,
  mimeType: m.mimeType,
  storage: m.storage,
  folderId: m.folderId,
  createdAt: m.createdAt.toISOString(),
});

/* ------------------------------- register ---------------------------------- */

const registerSchema = z.object({
  url: blobUrl(),
  filename: z.string().min(1).max(300),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  folderId: z.string().uuid().nullable(),
});

/** Called by the client after a successful direct-to-Blob upload. */
export async function registerUpload(input: z.infer<typeof registerSchema>) {
  const user = await requireUser('media:write');
  const data = registerSchema.parse(input);
  const [row] = await db
    .insert(media)
    .values({ ...data, storage: 'blob', createdBy: user.id })
    .onConflictDoUpdate({ target: media.url, set: { filename: data.filename } })
    .returning();
  revalidateMedia();
  return { ok: true as const, item: toItem(row) };
}

/* --------------------------------- edit ------------------------------------ */

const updateSchema = z.object({
  id: z.string().uuid(),
  alt: z.string().max(500).optional(),
  caption: z.string().max(1000).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export async function updateMedia(input: z.infer<typeof updateSchema>) {
  await requireUser('media:write');
  const { id, ...fields } = updateSchema.parse(input);
  await db.update(media).set({ ...fields, updatedAt: new Date() }).where(eq(media.id, id));
  // Alt text renders on public pages → refresh all content caches.
  revalidateEverything();
  return { ok: true as const };
}

/** Replace the file behind a media row (same row id, new blob URL). */
export async function replaceMedia(input: z.infer<typeof registerSchema> & { id: string }) {
  await requireUser('media:write');
  const { id: rawId, ...rest } = input;
  const id = z.string().uuid().parse(rawId);
  const data = registerSchema.parse(rest);
  const existing = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!existing) return { ok: false as const, error: 'Media not found' };

  await db.update(media).set({ ...data, storage: 'blob', updatedAt: new Date() }).where(eq(media.id, id));
  if (existing.storage === 'blob') {
    await del(existing.url).catch(() => undefined);
  }
  revalidateEverything();
  return { ok: true as const };
}

/* -------------------------------- delete ----------------------------------- */

export async function mediaUsage(id: string): Promise<string[]> {
  await requireUser('media:write');
  id = z.string().uuid().parse(id);
  const uses: string[] = [];
  const idLike = `%${id}%`;

  const [svcFeat, svcGallery, csCover, csGallery, postCover, testiAvatar, pageOg, sectionRefs, settingRefs] =
    await Promise.all([
      db.select({ n: services.name }).from(services).where(or(eq(services.featuredImageId, id), eq(services.ogImageId, id))),
      db.select({ n: serviceImages.serviceId }).from(serviceImages).where(eq(serviceImages.mediaId, id)),
      db.select({ n: caseStudies.client }).from(caseStudies).where(or(eq(caseStudies.coverImageId, id), eq(caseStudies.ogImageId, id))),
      db.select({ n: caseStudyGalleryImages.galleryId }).from(caseStudyGalleryImages).where(eq(caseStudyGalleryImages.mediaId, id)),
      db.select({ n: posts.title }).from(posts).where(or(eq(posts.coverImageId, id), eq(posts.ogImageId, id))),
      db.select({ n: testimonials.author }).from(testimonials).where(eq(testimonials.avatarId, id)),
      db.select({ n: pages.slug }).from(pages).where(eq(pages.ogImageId, id)),
      db.select({ n: pageSections.type }).from(pageSections).where(sql`${pageSections.data}::text LIKE ${idLike}`),
      db.select({ n: settings.key }).from(settings).where(sql`${settings.value}::text LIKE ${idLike}`),
    ]);

  for (const r of svcFeat) uses.push(`Service: ${r.n}`);
  if (svcGallery.length) uses.push(`${svcGallery.length} service gallery item(s)`);
  for (const r of csCover) uses.push(`Case study: ${r.n}`);
  if (csGallery.length) uses.push(`${csGallery.length} case-study gallery item(s)`);
  for (const r of postCover) uses.push(`Post: ${r.n}`);
  for (const r of testiAvatar) uses.push(`Testimonial: ${r.n}`);
  for (const r of pageOg) uses.push(`Page SEO: ${r.n}`);
  for (const r of sectionRefs) uses.push(`Page section: ${r.n}`);
  for (const r of settingRefs) uses.push(`Settings: ${r.n}`);
  return uses;
}

export async function deleteMedia(id: string) {
  await requireUser('media:write');
  const existing = await db.query.media.findFirst({ where: eq(media.id, z.string().uuid().parse(id)) });
  if (!existing) return { ok: false as const, error: 'Media not found' };

  // Gallery joins cascade; direct FKs are set-null — content keeps working.
  await db.delete(media).where(eq(media.id, id));
  if (existing.storage === 'blob') {
    await del(existing.url).catch(() => undefined);
  }
  revalidateEverything();
  return { ok: true as const };
}

/* -------------------------------- folders ---------------------------------- */

export async function createFolder(name: string, parentId: string | null) {
  await requireUser('media:write');
  const clean = z.string().min(1).max(100).parse(String(name).trim());
  const [row] = await db
    .insert(mediaFolders)
    .values({ name: clean, parentId: z.string().uuid().nullable().parse(parentId) })
    .onConflictDoNothing()
    .returning();
  revalidateMedia();
  return { ok: true as const, id: row?.id };
}

export async function renameFolder(id: string, name: string) {
  await requireUser('media:write');
  await db
    .update(mediaFolders)
    .set({ name: z.string().min(1).max(100).parse(String(name).trim()) })
    .where(eq(mediaFolders.id, z.string().uuid().parse(id)));
  revalidateMedia();
  return { ok: true as const };
}

export async function deleteFolder(id: string) {
  await requireUser('media:write');
  id = z.string().uuid().parse(id);
  // Files fall back to the root (folderId FK is set-null via update first).
  await db.update(media).set({ folderId: null }).where(eq(media.folderId, id));
  await db.update(mediaFolders).set({ parentId: null }).where(eq(mediaFolders.parentId, id));
  await db.delete(mediaFolders).where(eq(mediaFolders.id, id));
  revalidateMedia();
  return { ok: true as const };
}

/* --------------------------------- query ----------------------------------- */

const searchSchema = z.object({
  q: z.string().max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(40),
});

/** Server-paginated media search (also used by the MediaPicker dialog). */
export async function searchMedia(input: z.input<typeof searchSchema>) {
  await requireUser();
  const { q, folderId, page, perPage } = searchSchema.parse(input);

  const conditions = [];
  if (q) {
    conditions.push(
      or(ilike(media.filename, `%${q}%`), ilike(media.alt, `%${q}%`), ilike(media.url, `%${q}%`)),
    );
  }
  if (folderId !== undefined) {
    conditions.push(folderId === null ? isNull(media.folderId) : eq(media.folderId, folderId));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ n: count() }).from(media).where(where),
  ]);

  return {
    items: rows.map(toItem),
    total: Number(total[0]?.n ?? 0),
    page,
    totalPages: Math.max(1, Math.ceil(Number(total[0]?.n ?? 0) / perPage)),
  };
}

export async function listFolders() {
  await requireUser();
  const rows = await db.select().from(mediaFolders).orderBy(asc(mediaFolders.name));
  return rows.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }));
}
