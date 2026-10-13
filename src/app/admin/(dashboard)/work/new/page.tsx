import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { services } from '@/db/schema';
import { getWorkSettings } from '@/lib/data/settings';
import { CaseStudyForm, emptyCaseStudy } from '../CaseStudyForm';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'New case study' };
export const dynamic = 'force-dynamic';

export default async function NewCaseStudyPage() {
  await requireUser();

  const [serviceRows, workSettings] = await Promise.all([
    db.select({ name: services.name }).from(services).orderBy(asc(services.sortOrder)),
    getWorkSettings(),
  ]);

  return (
    <CaseStudyForm
      initial={emptyCaseStudy}
      serviceNames={serviceRows.map((s) => s.name)}
      industries={workSettings.industries}
    />
  );
}
