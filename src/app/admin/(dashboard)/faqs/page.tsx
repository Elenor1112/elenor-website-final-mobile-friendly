import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { faqCategories, faqs } from '@/db/schema';
import { PageHeader } from '@/components/admin/ui';
import { FaqManager } from './FaqManager';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'FAQ' };
export const dynamic = 'force-dynamic';

export default async function FaqAdminPage() {
  await requireUser();

  const [categories, items] = await Promise.all([
    db.select().from(faqCategories).orderBy(asc(faqCategories.sortOrder)),
    db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
  ]);

  return (
    <div>
      <PageHeader
        title="FAQ"
        description="Questions shown on the FAQ hub and About page. FAQPage schema updates automatically. (Service-specific FAQs live on each service.)"
      />
      <FaqManager
        categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        items={items.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          categoryId: f.categoryId,
          isActive: f.isActive,
        }))}
      />
    </div>
  );
}
