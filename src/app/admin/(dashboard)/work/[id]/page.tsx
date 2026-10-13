import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { services } from '@/db/schema';
import { getCaseStudyForEdit } from '@/server/actions/work';
import { getWorkSettings } from '@/lib/data/settings';
import { CaseStudyForm, type CaseStudyFormValue } from '../CaseStudyForm';
import { emptySeo } from '@/components/admin/SeoFieldset';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Edit case study' };
export const dynamic = 'force-dynamic';

type Media = { id: string; url: string; alt: string } | null;

export default async function EditCaseStudyPage({ params }: { params: { id: string } }) {
  await requireUser();

  const [row, serviceRows, workSettings] = await Promise.all([
    getCaseStudyForEdit(params.id).catch(() => null) as Promise<
      | (NonNullable<Awaited<ReturnType<typeof getCaseStudyForEdit>>> & {
          coverImage: Media;
          ogImage: Media;
          galleries: {
            label: string;
            serviceSlug: string | null;
            videoUrls: string[];
            images: {
              id: string;
              type: 'image' | 'model';
              environmentPreset: 'forest' | 'studio' | 'city' | 'sunset' | 'warehouse';
              autoRotate: boolean;
              enableHoverRotation: boolean;
              enableMouseParallax: boolean;
              modelXOffset: number;
              modelYOffset: number;
              media: Media | null;
              modelMedia: Media | null;
            }[];
          }[];
        })
      | null
    >,
    db.select({ name: services.name }).from(services).orderBy(asc(services.sortOrder)),
    getWorkSettings(),
  ]);
  if (!row) notFound();

  const initial: CaseStudyFormValue = {
    id: row.id,
    slug: row.slug,
    client: row.client,
    industry: row.industry,
    // The primary is implicit in the form's chip row; show only the extras.
    industries: (row.industries ?? []).filter((i) => i !== row.industry),
    services: row.services,
    categories: row.categories,
    technologies: row.technologies,
    result: row.result,
    description: row.description ?? null,
    metrics: row.metrics,
    testimonial: row.testimonial ?? { quote: '', author: '', role: '' },
    coverImage: row.coverImage
      ? { id: row.coverImage.id, url: row.coverImage.url, alt: row.coverImage.alt }
      : null,
    featured: row.featured,
    status: row.status,
    galleries: row.galleries.map((g) => ({
      label: g.label,
      serviceSlug: g.serviceSlug,
      videoUrls: g.videoUrls ?? [],
      // Keep rows that have something to show: an image, or a model file.
      items: g.images
        .filter((i) => i.media || i.modelMedia)
        .map((i) => ({
          key: i.id,
          type: i.type,
          image: i.media ? { id: i.media.id, url: i.media.url, alt: i.media.alt } : null,
          model: i.modelMedia
            ? { id: i.modelMedia.id, url: i.modelMedia.url, alt: i.modelMedia.alt }
            : null,
          environmentPreset: i.environmentPreset,
          autoRotate: i.autoRotate,
          enableHoverRotation: i.enableHoverRotation,
          enableMouseParallax: i.enableMouseParallax,
          modelXOffset: i.modelXOffset,
          modelYOffset: i.modelYOffset,
        })),
    })),
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

  return (
    <CaseStudyForm
      initial={initial}
      serviceNames={serviceRows.map((s) => s.name)}
      industries={workSettings.industries}
    />
  );
}
