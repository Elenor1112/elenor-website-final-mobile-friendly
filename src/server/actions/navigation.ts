'use server';

import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { menuItems, menus } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { revalidateMenus } from '@/lib/revalidate';
import { logAudit } from './audit';
import { safeHref } from '@/lib/validation/url';

export async function getMenusForEdit() {
  await requireUser();
  const rows = await db.query.menus.findMany({
    with: { items: { orderBy: [asc(menuItems.sortOrder)] } },
  });
  const order = ['header', 'header-cta', 'footer-company'];
  return rows
    .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      items: m.items.map((i) => ({
        id: i.id,
        label: i.label,
        url: i.url,
        isExternal: i.isExternal,
        openInNewTab: i.openInNewTab,
        isEnabled: i.isEnabled,
      })),
    }));
}

const itemSchema = z.object({
  label: z.string().min(1).max(120),
  url: safeHref().pipe(z.string().min(1).max(500)),
  isExternal: z.boolean().default(false),
  openInNewTab: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
});

const saveSchema = z.object({
  menuSlug: z.string().min(1),
  items: z.array(itemSchema).max(50),
});

/** Replace-all save for one menu's items (order = array order). */
export async function saveMenuItems(input: z.input<typeof saveSchema>) {
  const user = await requireUser('navigation:write');
  const { menuSlug, items } = saveSchema.parse(input);

  const menu = await db.query.menus.findFirst({ where: eq(menus.slug, menuSlug) });
  if (!menu) return { ok: false as const, error: 'Menu not found' };

  await db.delete(menuItems).where(eq(menuItems.menuId, menu.id));
  if (items.length > 0) {
    await db.insert(menuItems).values(
      items.map((item, i) => ({ ...item, menuId: menu.id, sortOrder: i })),
    );
  }
  revalidateMenus();
  await logAudit(user.id, 'update', 'menu', menu.id, menu.name);
  return { ok: true as const };
}
