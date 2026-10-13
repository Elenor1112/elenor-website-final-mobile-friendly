import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { can, getCurrentUser } from '@/server/auth/rbac';
import { csvCell } from '@/lib/csv';

// CSV export of the inbox, honoring the same q/status filters as the list.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, 'messages:write')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const status = url.searchParams.get('status');

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(contactMessages.name, like),
        ilike(contactMessages.email, like),
        ilike(contactMessages.company, like),
        ilike(contactMessages.message, like),
      )!,
    );
  }
  if (status && ['new', 'read', 'replied', 'archived'].includes(status)) {
    conditions.push(eq(contactMessages.status, status as never));
  }

  const rows = await db
    .select()
    .from(contactMessages)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(contactMessages.createdAt));

  const header = ['Date', 'Name', 'Email', 'Phone', 'Company', 'Service', 'Budget', 'Status', 'Message', 'Internal note'];
  const lines = [
    header.join(','),
    ...rows.map((m) =>
      [
        m.createdAt.toISOString(),
        m.name,
        m.email,
        m.phone,
        m.company,
        m.service,
        m.budget,
        m.status,
        m.message,
        m.internalNote,
      ]
        .map((v) => csvCell(String(v ?? '')))
        .join(','),
    ),
  ];

  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="elenor-messages-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
