import type { Metadata } from 'next';
import { ServiceForm, emptyService } from '../ServiceForm';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'New service' };
export const dynamic = 'force-dynamic';

export default async function NewServicePage() {
  await requireUser();

  return <ServiceForm initial={emptyService} />;
}
