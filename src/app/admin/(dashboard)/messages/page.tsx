import type { Metadata } from 'next';
import Link from 'next/link';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { Badge, Button, Card, PageHeader } from '@/components/admin/ui';
import { ListToolbar, Pagination } from '@/components/admin/ListToolbar';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

export default async function MessagesAdminPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  await requireUser('messages:write');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const conditions: SQL[] = [];
  if (searchParams.q) {
    const like = `%${searchParams.q}%`;
    conditions.push(
      or(
        ilike(contactMessages.name, like),
        ilike(contactMessages.email, like),
        ilike(contactMessages.company, like),
        ilike(contactMessages.message, like),
      )!,
    );
  }
  if (searchParams.status && ['new', 'read', 'replied', 'archived'].includes(searchParams.status)) {
    conditions.push(eq(contactMessages.status, searchParams.status as never));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(contactMessages)
      .where(where)
      .orderBy(desc(contactMessages.createdAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ n: count() }).from(contactMessages).where(where),
  ]);
  const totalPages = Math.max(1, Math.ceil(Number(total[0]?.n ?? 0) / PER_PAGE));

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const exportQuery = new URLSearchParams();
  if (searchParams.q) exportQuery.set('q', searchParams.q);
  if (searchParams.status) exportQuery.set('status', searchParams.status);

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Messages from the contact form."
        actions={
          <a href={`/api/messages/export?${exportQuery.toString()}`}>
            <Button variant="secondary">Export CSV</Button>
          </a>
        }
      />

      <ListToolbar
        searchPlaceholder="Search name, email, message…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'new', label: 'New' },
              { value: 'read', label: 'Read' },
              { value: 'replied', label: 'Replied' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card className="py-16 text-center text-white/40">No messages match.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <Link
              key={m.id}
              href={`/admin/messages/${m.id}`}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/25"
            >
              <div className="min-w-0 flex-1">
                <p className={m.status === 'new' ? 'font-semibold' : 'font-medium'}>
                  {m.name}
                  {m.company ? <span className="text-white/40"> · {m.company}</span> : null}
                </p>
                <p className="truncate text-xs text-white/45">
                  {m.service ? `${m.service} — ` : ''}
                  {m.message}
                </p>
              </div>
              <span className="hidden text-xs text-white/35 sm:block">{fmt(m.createdAt)}</span>
              <Badge value={m.status} />
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
