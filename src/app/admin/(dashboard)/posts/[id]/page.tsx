import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { postCategories } from '@/db/schema';
import { getPostForEdit } from '@/server/actions/posts';
import { PostForm, type PostFormValue } from '../PostForm';
import { emptySeo } from '@/components/admin/SeoFieldset';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Edit post' };
export const dynamic = 'force-dynamic';

type Media = { id: string; url: string; alt: string } | null;

function toLocalInput(d: Date | null): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditPostPage({ params }: { params: { id: string } }) {
  await requireUser();

  const [row, categories] = await Promise.all([
    getPostForEdit(params.id).catch(() => null) as Promise<
      | (NonNullable<Awaited<ReturnType<typeof getPostForEdit>>> & {
          coverImage: Media;
          ogImage: Media;
          tags: { tag: { name: string } }[];
        })
      | null
    >,
    db
      .select({ id: postCategories.id, name: postCategories.name })
      .from(postCategories)
      .orderBy(asc(postCategories.sortOrder)),
  ]);
  if (!row) notFound();

  const initial: PostFormValue = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImage: row.coverImage
      ? { id: row.coverImage.id, url: row.coverImage.url, alt: row.coverImage.alt }
      : null,
    authorName: row.authorName,
    authorTitle: row.authorTitle,
    categoryId: row.categoryId,
    tags: row.tags.map((t) => t.tag.name),
    status: row.status,
    publishedAtLocal: toLocalInput(row.publishedAt),
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

  return <PostForm initial={initial} categories={categories} />;
}
