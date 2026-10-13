import type { Metadata } from 'next';
import Link from 'next/link';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { postCategories, posts } from '@/db/schema';
import { Badge, Button, Card, PageHeader } from '@/components/admin/ui';
import { ListToolbar, Pagination } from '@/components/admin/ListToolbar';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Blog' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

export default async function PostsAdminPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  await requireUser();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const conditions: SQL[] = [];
  if (searchParams.q) {
    const like = `%${searchParams.q}%`;
    conditions.push(or(ilike(posts.title, like), ilike(posts.slug, like))!);
  }
  if (
    searchParams.status &&
    ['draft', 'scheduled', 'published', 'archived'].includes(searchParams.status)
  ) {
    conditions.push(eq(posts.status, searchParams.status as never));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, total, categories] = await Promise.all([
    db.query.posts.findMany({
      where,
      orderBy: [desc(posts.updatedAt)],
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
      with: { category: true } as never,
    }),
    db.select({ n: count() }).from(posts).where(where),
    db.select().from(postCategories),
  ]);
  const totalPages = Math.max(1, Math.ceil(Number(total[0]?.n ?? 0) / PER_PAGE));

  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';

  return (
    <div>
      <PageHeader
        title="Blog"
        description="Write, schedule, and publish articles."
        actions={
          <Link href="/admin/posts/new">
            <Button>New post</Button>
          </Link>
        }
      />

      <ListToolbar
        searchPlaceholder="Search posts…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card className="py-16 text-center text-white/40">No posts match.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const cat = (p as unknown as { category: { name: string } | null }).category;
            return (
              <Link
                key={p.id}
                href={`/admin/posts/${p.id}`}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/25"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-white/40">
                    {cat?.name ?? 'Uncategorized'} · {p.authorName} ·{' '}
                    {p.status === 'scheduled' ? `goes live ${fmt(p.publishedAt)}` : fmt(p.publishedAt)}
                  </p>
                </div>
                <Badge value={p.status} />
              </Link>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />

      {categories.length > 0 ? (
        <p className="mt-8 text-xs text-white/35">
          Categories: {categories.map((c) => c.name).join(', ')} — manage them inside any post editor.
        </p>
      ) : null}
    </div>
  );
}
