import type { Metadata } from 'next';
import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { Card, PageHeader } from '@/components/admin/ui';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Pages' };
export const dynamic = 'force-dynamic';

const DESCRIPTIONS: Record<string, string> = {
  home: 'Hero, philosophy, showcase, stats, clients, blog preview, CTA',
  about: 'Hero, CEO quote, story, values, mission/vision, timeline, team, FAQ',
  services: 'SEO settings for the services hub',
  work: 'SEO settings for the portfolio hub',
  blog: 'SEO settings for the blog hub',
  faq: 'SEO settings for the FAQ hub',
  contact: 'SEO settings for the contact page',
};

export default async function PagesAdminPage() {
  await requireUser();

  const rows = await db.select().from(pages).orderBy(asc(pages.slug));
  const order = ['home', 'about', 'services', 'work', 'blog', 'faq', 'contact'];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Edit page sections and per-page SEO. Collection content (services, work, posts) lives in its own tab."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((p) => (
          <Link key={p.slug} href={`/admin/pages/${p.slug}`}>
            <Card className="transition hover:border-white/25">
              <p className="font-display text-lg font-semibold capitalize">{p.title || p.slug}</p>
              <p className="mt-1 text-sm text-white/45">{DESCRIPTIONS[p.slug] ?? 'Page settings'}</p>
              <p className="mt-3 text-xs text-white/30">/{p.slug === 'home' ? '' : p.slug}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
