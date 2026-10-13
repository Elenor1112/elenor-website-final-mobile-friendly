import type { Metadata } from 'next';
import { MediaLibrary } from '@/components/admin/media/MediaLibrary';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Media' };
export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  await requireUser();

  return <MediaLibrary />;
}
