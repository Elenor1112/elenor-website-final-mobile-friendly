import type { Metadata } from 'next';
import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { caseStudies } from '@/db/schema';
import { Button, PageHeader } from '@/components/admin/ui';
import { WorkList } from './WorkList';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Work' };
export const dynamic = 'force-dynamic';

export default async function WorkAdminPage() {
  await requireUser();

  const rows = await db
    .select({
      id: caseStudies.id,
      slug: caseStudies.slug,
      client: caseStudies.client,
      industry: caseStudies.industry,
      status: caseStudies.status,
      featured: caseStudies.featured,
      updatedAt: caseStudies.updatedAt,
    })
    .from(caseStudies)
    .orderBy(asc(caseStudies.sortOrder));

  return (
    <div>
      <PageHeader
        title="Work / Portfolio"
        description="Drag to reorder — the order here is the order on the site."
        actions={
          <Link href="/admin/work/new">
            <Button>New case study</Button>
          </Link>
        }
      />
      <WorkList items={rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))} />
    </div>
  );
}
