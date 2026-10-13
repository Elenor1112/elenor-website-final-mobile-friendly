import type { Metadata } from 'next';
import { getMenusForEdit } from '@/server/actions/navigation';
import { PageHeader } from '@/components/admin/ui';
import { NavigationManager } from './NavigationManager';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Navigation' };
export const dynamic = 'force-dynamic';

export default async function NavigationAdminPage() {
  await requireUser('navigation:write');

  const menus = await getMenusForEdit();

  return (
    <div>
      <PageHeader
        title="Navigation"
        description="Header links, the header button, and the footer Company column. The footer Services column always mirrors your published services; social links live in Settings → Site."
      />
      <NavigationManager menus={menus} />
    </div>
  );
}
