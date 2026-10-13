import type { Metadata } from 'next';
import {
  getAnalyticsSettings,
  getContactSettings,
  getSiteSettings,
  getThemeSettings,
  getWorkSettings,
} from '@/lib/data/settings';
import { PageHeader } from '@/components/admin/ui';
import { SettingsTabs } from './SettingsTabs';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsAdminPage() {
  await requireUser('settings:write');

  const [site, theme, analytics, contact, work] = await Promise.all([
    getSiteSettings(),
    getThemeSettings(),
    getAnalyticsSettings(),
    getContactSettings(),
    getWorkSettings(),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company details, brand colors, analytics, and site-wide options. Changes apply instantly across every page, schema markup, and llms.txt."
      />
      <SettingsTabs site={site} theme={theme} analytics={analytics} contact={contact} work={work} />
    </div>
  );
}
