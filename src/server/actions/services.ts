'use server';

import { asc, eq, ne, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { serviceImages, services } from '@/db/schema';
import type { FaqItem, RichTextDoc } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { revalidateServices } from '@/lib/revalidate';
import { serviceInputSchema, type ServiceInput } from '@/lib/validation/content';
import { logAudit } from './audit';

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveService(input: ServiceInput): Promise<ActionResult> {
  const user = await requireUser('content:write');
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { id, galleryMediaIds, seo, ...data } = parsed.data;

  // Slug must be unique across other services.
  const clash = await db.query.services.findFirst({
    where: id ? and(eq(services.slug, data.slug), ne(services.id, id)) : eq(services.slug, data.slug),
  });
  if (clash) return { ok: false, error: `Slug “${data.slug}” is already in use.` };

  const values = {
    ...data,
    body: data.body as RichTextDoc | null,
    faqs: data.faqs as FaqItem[],
    ...seo,
    updatedAt: new Date(),
  };

  let serviceId = id;
  let previousSlug: string | undefined;
  if (id) {
    const existing = await db.query.services.findFirst({ where: eq(services.id, id) });
    if (!existing) return { ok: false, error: 'Service not found' };
    previousSlug = existing.slug;
    await db.update(services).set(values).where(eq(services.id, id));
  } else {
    const last = await db.query.services.findMany({
      orderBy: (s, { desc }) => [desc(s.sortOrder)],
      limit: 1,
    });
    const [row] = await db
      .insert(services)
      .values({ ...values, sortOrder: (last[0]?.sortOrder ?? -1) + 1 })
      .returning({ id: services.id });
    serviceId = row.id;
  }

  // Gallery: replace-all keeps ordering trivial and idempotent.
  await db.delete(serviceImages).where(eq(serviceImages.serviceId, serviceId!));
  if (galleryMediaIds.length > 0) {
    await db.insert(serviceImages).values(
      galleryMediaIds.map((mediaId, i) => ({ serviceId: serviceId!, mediaId, sortOrder: i })),
    );
  }

  revalidateServices(data.slug);
  if (previousSlug && previousSlug !== data.slug) revalidateServices(previousSlug);
  await logAudit(user.id, id ? 'update' : 'create', 'service', serviceId!, data.name);
  return { ok: true, id: serviceId! };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const user = await requireUser('content:write');
  const existing = await db.query.services.findFirst({ where: eq(services.id, z.string().uuid().parse(id)) });
  if (!existing) return { ok: false, error: 'Service not found' };
  await db.delete(services).where(eq(services.id, id));
  revalidateServices(existing.slug);
  await logAudit(user.id, 'delete', 'service', id, existing.name);
  return { ok: true, id };
}

export async function reorderServices(ids: string[]): Promise<{ ok: boolean }> {
  await requireUser('content:write');
  const parsed = z.array(z.string().uuid()).parse(ids);
  await Promise.all(
    parsed.map((id, i) =>
      db.update(services).set({ sortOrder: i }).where(eq(services.id, id)),
    ),
  );
  revalidateServices();
  return { ok: true };
}

export async function setServiceStatus(
  id: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionResult> {
  const user = await requireUser('content:write');
  // Arguments arrive straight from the client; TypeScript types are not enforced at runtime.
  id = z.string().uuid().parse(id);
  status = z.enum(['draft', 'published', 'archived']).parse(status);
  const existing = await db.query.services.findFirst({ where: eq(services.id, id) });
  if (!existing) return { ok: false, error: 'Service not found' };
  await db.update(services).set({ status, updatedAt: new Date() }).where(eq(services.id, id));
  revalidateServices(existing.slug);
  await logAudit(user.id, status === 'published' ? 'publish' : 'update', 'service', id, existing.name);
  return { ok: true, id };
}

/** Full rows for the admin editor (uncached — admin always sees fresh data). */
export async function getServiceForEdit(id: string) {
  await requireUser();
  const row = await db.query.services.findFirst({
    where: eq(services.id, z.string().uuid().parse(id)),
    with: {
      featuredImage: true,
      ogImage: true,
      gallery: { orderBy: [asc(serviceImages.sortOrder)], with: { media: true } },
    } as never,
  });
  return row ?? null;
}
