import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { testimonials } from '@/db/schema';
import { PageHeader } from '@/components/admin/ui';
import { TestimonialsManager } from './TestimonialsManager';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Testimonials' };
export const dynamic = 'force-dynamic';

export default async function TestimonialsAdminPage() {
  await requireUser();

  const rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder));

  return (
    <div>
      <PageHeader
        title="Testimonials"
        description="Shown in the home “Trusted by” reel. Drag to reorder; toggle to hide."
      />
      <TestimonialsManager
        items={rows.map((t) => ({
          id: t.id,
          quote: t.quote,
          author: t.author,
          role: t.role,
          company: t.company,
          isActive: t.isActive,
        }))}
      />
    </div>
  );
}
