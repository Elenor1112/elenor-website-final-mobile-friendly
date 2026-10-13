import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServiceForEdit } from '@/server/actions/services';
import { ServiceForm, type ServiceFormValue } from '../ServiceForm';
import { emptySeo } from '@/components/admin/SeoFieldset';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Edit service' };
export const dynamic = 'force-dynamic';

type Media = { id: string; url: string; alt: string } | null;

export default async function EditServicePage({ params }: { params: { id: string } }) {
  await requireUser();

  const row = (await getServiceForEdit(params.id).catch(() => null)) as
    | (Awaited<ReturnType<typeof getServiceForEdit>> & {
        featuredImage: Media;
        ogImage: Media;
        gallery: { media: Media }[];
      })
    | null;
  if (!row) notFound();

  const initial: ServiceFormValue = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    name: row.name,
    short: row.short,
    lede: row.lede,
    metaDescription: row.metaDescription,
    body: row.body ?? null,
    included: row.included,
    process: row.process,
    proof: row.proof,
    faqs: row.faqs,
    accent: row.accent,
    icon: (row.icon as ServiceFormValue['icon']) ?? 'box',
    featuredImage: row.featuredImage
      ? { id: row.featuredImage.id, url: row.featuredImage.url, alt: row.featuredImage.alt }
      : null,
    gallery: row.gallery
      .filter((g) => g.media)
      .map((g) => ({ id: g.media!.id, url: g.media!.url, alt: g.media!.alt })),
    status: row.status,
    seo: {
      ...emptySeo,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      ogImage: row.ogImage ? { id: row.ogImage.id, url: row.ogImage.url, alt: row.ogImage.alt } : null,
      canonicalUrl: row.canonicalUrl,
      noIndex: row.noIndex,
      seoKeywords: row.seoKeywords ?? [],
    },
  };

  return <ServiceForm initial={initial} />;
}
