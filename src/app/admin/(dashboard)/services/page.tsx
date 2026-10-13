import type { Metadata } from 'next';
import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { services } from '@/db/schema';
import { Button, PageHeader } from '@/components/admin/ui';
import { ServicesList } from './ServicesList';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

export default async function ServicesAdminPage() {
  await requireUser();

  const rows = await db
    .select({
      id: services.id,
      slug: services.slug,
      name: services.name,
      short: services.short,
      status: services.status,
      updatedAt: services.updatedAt,
    })
    .from(services)
    .orderBy(asc(services.sortOrder));

  return (
    <div>
      <PageHeader
        title="Services"
        description="Drag to reorder — the order here is the order on the site."
        actions={
          <Link href="/admin/services/new">
            <Button>New service</Button>
          </Link>
        }
      />
      <ServicesList
        items={rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))}
      />
    </div>
  );
}
