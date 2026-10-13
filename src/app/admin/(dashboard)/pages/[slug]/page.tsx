import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageForEdit } from '@/server/actions/pages';
import { emptySeo } from '@/components/admin/SeoFieldset';
import { PageEditor } from './PageEditor';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Edit page' };
export const dynamic = 'force-dynamic';

type Media = { id: string; url: string; alt: string } | null;

export default async function EditPagePage({ params }: { params: { slug: string } }) {
  await requireUser();

  const row = (await getPageForEdit(params.slug).catch(() => null)) as
    | (NonNullable<Awaited<ReturnType<typeof getPageForEdit>>> & {
        ogImage: Media;
        sections: { id: string; type: string; data: Record<string, unknown>; isEnabled: boolean }[];
      })
    | null;
  if (!row) notFound();

  return (
    <PageEditor
      slug={row.slug}
      title={row.title}
      seo={{
        ...emptySeo,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        ogImage: row.ogImage ? { id: row.ogImage.id, url: row.ogImage.url, alt: row.ogImage.alt } : null,
        canonicalUrl: row.canonicalUrl,
        noIndex: row.noIndex,
        seoKeywords: row.seoKeywords ?? [],
      }}
      sections={row.sections.map((s) => ({
        id: s.id,
        type: s.type,
        data: s.data,
        isEnabled: s.isEnabled,
      }))}
    />
  );
}
