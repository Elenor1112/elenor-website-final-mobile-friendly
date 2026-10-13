'use server';

import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { pages, pageSections } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { revalidatePages, revalidateEverything } from '@/lib/revalidate';
import { sectionSchemas, type SectionType } from '@/lib/validation/sections';
import { seoInputSchema, type SeoInput } from '@/lib/validation/content';
import { logAudit } from './audit';

export async function getPageForEdit(slug: string) {
  await requireUser();
  const row = await db.query.pages.findFirst({
    where: eq(pages.slug, slug),
    with: {
      ogImage: true,
      sections: { orderBy: [asc(pageSections.sortOrder)] },
    } as never,
  });
  return row ?? null;
}

const sectionSaveSchema = z.object({
  id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
  isEnabled: z.boolean(),
});

/** Saves one section's content + enabled flag (validated against its type). */
export async function saveSection(input: z.input<typeof sectionSaveSchema>) {
  const user = await requireUser('content:write');
  const { id, data, isEnabled } = sectionSaveSchema.parse(input);

  const section = await db.query.pageSections.findFirst({ where: eq(pageSections.id, id) });
  if (!section) return { ok: false as const, error: 'Section not found' };

  // Unknown section types have no contract, so never store their raw input.
  const schema = sectionSchemas[section.type as SectionType];
  if (!schema) return { ok: false as const, error: 'This section type cannot be edited.' };
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid section data' };
  }

  await db
    .update(pageSections)
    .set({ data: parsed.data as Record<string, unknown>, isEnabled, updatedAt: new Date() })
    .where(eq(pageSections.id, id));

  const page = await db.query.pages.findFirst({ where: eq(pages.id, section.pageId) });
  revalidatePages(page?.slug);
  // The shared CTA and hero settings feed multiple routes.
  if (section.type === 'cta') revalidateEverything();
  await logAudit(user.id, 'update', 'page_section', id, `${page?.slug}/${section.type}`, section.data);
  return { ok: true as const };
}

export async function reorderSections(pageSlug: string, ids: string[]) {
  await requireUser('content:write');
  const parsed = z.array(z.string().uuid()).parse(ids);
  await Promise.all(
    parsed.map((id, i) =>
      db.update(pageSections).set({ sortOrder: i, updatedAt: new Date() }).where(eq(pageSections.id, id)),
    ),
  );
  revalidatePages(pageSlug);
  return { ok: true as const };
}

export async function toggleSection(id: string, isEnabled: boolean) {
  await requireUser('content:write');
  const section = await db.query.pageSections.findFirst({ where: eq(pageSections.id, id) });
  if (!section) return { ok: false as const };
  await db.update(pageSections).set({ isEnabled, updatedAt: new Date() }).where(eq(pageSections.id, id));
  const page = await db.query.pages.findFirst({ where: eq(pages.id, section.pageId) });
  revalidatePages(page?.slug);
  return { ok: true as const };
}

const pageSeoSchema = z.object({
  slug: z.string().min(1),
  title: z.string().max(200).default(''),
  seo: seoInputSchema,
});

export async function savePageSeo(input: { slug: string; title: string; seo: SeoInput }) {
  const user = await requireUser('content:write');
  const { slug, title, seo } = pageSeoSchema.parse(input);
  await db.update(pages).set({ title, ...seo, updatedAt: new Date() }).where(eq(pages.slug, slug));
  revalidatePages(slug);
  await logAudit(user.id, 'update', 'page_seo', slug, title || slug);
  return { ok: true as const };
}
