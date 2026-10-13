'use server';

import { and, asc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  caseStudies,
  caseStudyGalleries,
  caseStudyGalleryImages,
  rosterClients,
} from '@/db/schema';
import type { MetricItem, RichTextDoc, TestimonialData } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { revalidateCaseStudies, revalidateRoster } from '@/lib/revalidate';
import { caseStudyInputSchema, type CaseStudyInput } from '@/lib/validation/content';
import { logAudit } from './audit';
import type { ActionResult } from './services';

export async function saveCaseStudy(input: CaseStudyInput): Promise<ActionResult> {
  const user = await requireUser('content:write');
  const parsed = caseStudyInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { id, galleries, seo, testimonial, ...data } = parsed.data;

  const clash = await db.query.caseStudies.findFirst({
    where: id
      ? and(eq(caseStudies.slug, data.slug), ne(caseStudies.id, id))
      : eq(caseStudies.slug, data.slug),
  });
  if (clash) return { ok: false, error: `Slug “${data.slug}” is already in use.` };

  const values = {
    ...data,
    description: data.description as RichTextDoc | null,
    metrics: data.metrics as MetricItem[],
    testimonial: (testimonial && testimonial.quote ? testimonial : null) as TestimonialData,
    ...seo,
    updatedAt: new Date(),
  };

  let csId = id;
  let previousSlug: string | undefined;
  if (id) {
    const existing = await db.query.caseStudies.findFirst({ where: eq(caseStudies.id, id) });
    if (!existing) return { ok: false, error: 'Case study not found' };
    previousSlug = existing.slug;
    await db.update(caseStudies).set(values).where(eq(caseStudies.id, id));
  } else {
    const last = await db.query.caseStudies.findMany({
      orderBy: (c, { desc }) => [desc(c.sortOrder)],
      limit: 1,
    });
    const [row] = await db
      .insert(caseStudies)
      .values({ ...values, sortOrder: (last[0]?.sortOrder ?? -1) + 1 })
      .returning({ id: caseStudies.id });
    csId = row.id;
  }

  // Galleries: replace-all (delete cascades to the image join rows).
  await db.delete(caseStudyGalleries).where(eq(caseStudyGalleries.caseStudyId, csId!));
  for (let g = 0; g < galleries.length; g++) {
    const gallery = galleries[g];
    const [row] = await db
      .insert(caseStudyGalleries)
      .values({
        caseStudyId: csId!,
        label: gallery.label,
        serviceSlug: gallery.serviceSlug,
        sortOrder: g,
        videoUrls: gallery.videoUrls,
      })
      .returning({ id: caseStudyGalleries.id });
    if (gallery.items.length > 0) {
      await db.insert(caseStudyGalleryImages).values(
        gallery.items.map((item, i) => ({
          galleryId: row.id,
          // For model rows this is the optional poster.
          mediaId: item.mediaId,
          type: item.type,
          modelMediaId: item.type === 'model' ? item.modelMediaId : null,
          environmentPreset: item.environmentPreset,
          autoRotate: item.autoRotate,
          enableHoverRotation: item.enableHoverRotation,
          enableMouseParallax: item.enableMouseParallax,
          modelXOffset: item.modelXOffset,
          modelYOffset: item.modelYOffset,
          sortOrder: i,
        })),
      );
    }
  }

  revalidateCaseStudies(data.slug);
  if (previousSlug && previousSlug !== data.slug) revalidateCaseStudies(previousSlug);
  await logAudit(user.id, id ? 'update' : 'create', 'case_study', csId!, data.client);
  return { ok: true, id: csId! };
}

export async function deleteCaseStudy(id: string): Promise<ActionResult> {
  const user = await requireUser('content:write');
  const existing = await db.query.caseStudies.findFirst({
    where: eq(caseStudies.id, z.string().uuid().parse(id)),
  });
  if (!existing) return { ok: false, error: 'Case study not found' };
  await db.delete(caseStudies).where(eq(caseStudies.id, id));
  revalidateCaseStudies(existing.slug);
  await logAudit(user.id, 'delete', 'case_study', id, existing.client);
  return { ok: true, id };
}

export async function reorderCaseStudies(ids: string[]): Promise<{ ok: boolean }> {
  await requireUser('content:write');
  const parsed = z.array(z.string().uuid()).parse(ids);
  await Promise.all(
    parsed.map((id, i) => db.update(caseStudies).set({ sortOrder: i }).where(eq(caseStudies.id, id))),
  );
  revalidateCaseStudies();
  return { ok: true };
}

export async function setCaseStudyStatus(
  id: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionResult> {
  const user = await requireUser('content:write');
  // Arguments arrive straight from the client; TypeScript types are not enforced at runtime.
  id = z.string().uuid().parse(id);
  status = z.enum(['draft', 'published', 'archived']).parse(status);
  const existing = await db.query.caseStudies.findFirst({ where: eq(caseStudies.id, id) });
  if (!existing) return { ok: false, error: 'Case study not found' };
  await db.update(caseStudies).set({ status, updatedAt: new Date() }).where(eq(caseStudies.id, id));
  revalidateCaseStudies(existing.slug);
  await logAudit(user.id, status === 'published' ? 'publish' : 'update', 'case_study', id, existing.client);
  return { ok: true, id };
}

export async function getCaseStudyForEdit(id: string) {
  await requireUser();
  const row = await db.query.caseStudies.findFirst({
    where: eq(caseStudies.id, z.string().uuid().parse(id)),
    with: {
      coverImage: true,
      ogImage: true,
      galleries: {
        orderBy: [asc(caseStudyGalleries.sortOrder)],
        with: {
          images: {
            orderBy: [asc(caseStudyGalleryImages.sortOrder)],
            with: { media: true, modelMedia: true },
          },
        },
      },
    } as never,
  });
  return row ?? null;
}

/* ------------------------------ roster clients ------------------------------ */

const rosterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  industries: z.array(z.string().min(1).max(120)).default([]),
  isActive: z.boolean().default(true),
});

export async function saveRosterClient(input: z.input<typeof rosterSchema>): Promise<ActionResult> {
  await requireUser('content:write');
  const { id, ...data } = rosterSchema.parse(input);
  if (id) {
    await db.update(rosterClients).set(data).where(eq(rosterClients.id, id));
    revalidateRoster();
    return { ok: true, id };
  }
  const [row] = await db.insert(rosterClients).values(data).returning({ id: rosterClients.id });
  revalidateRoster();
  return { ok: true, id: row.id };
}

export async function deleteRosterClient(id: string): Promise<{ ok: boolean }> {
  await requireUser('content:write');
  await db.delete(rosterClients).where(eq(rosterClients.id, z.string().uuid().parse(id)));
  revalidateRoster();
  return { ok: true };
}
