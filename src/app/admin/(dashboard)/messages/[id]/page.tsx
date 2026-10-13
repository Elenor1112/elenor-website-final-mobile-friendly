import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { setMessageStatus } from '@/server/actions/messages';
import { Card, PageHeader } from '@/components/admin/ui';
import { MessageActions } from './MessageActions';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Message' };
export const dynamic = 'force-dynamic';

export default async function MessageDetailPage({ params }: { params: { id: string } }) {
  await requireUser('messages:write');

  const m = await db.query.contactMessages
    .findFirst({ where: eq(contactMessages.id, params.id) })
    .catch(() => null);
  if (!m) notFound();

  // Opening a new message marks it read.
  if (m.status === 'new') {
    await setMessageStatus(m.id, 'read').catch(() => undefined);
    m.status = 'read';
  }

  const fmt = m.createdAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={m.name}
        description={fmt}
        actions={
          <Link href="/admin/messages" className="text-xs text-white/50 hover:text-white">
            ← Back to inbox
          </Link>
        }
      />

      <Card className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-white/40">Email</dt>
            <dd>
              <a href={`mailto:${m.email}`} className="text-brand-glow hover:underline">
                {m.email}
              </a>
            </dd>
          </div>
          {m.phone ? (
            <div>
              <dt className="text-xs text-white/40">Phone</dt>
              <dd>
                <a href={`tel:${m.phone}`} className="text-brand-glow hover:underline">
                  {m.phone}
                </a>
              </dd>
            </div>
          ) : null}
          {m.company ? (
            <div>
              <dt className="text-xs text-white/40">Company</dt>
              <dd>{m.company}</dd>
            </div>
          ) : null}
          {m.role ? (
            <div>
              <dt className="text-xs text-white/40">Role</dt>
              <dd>{m.role}</dd>
            </div>
          ) : null}
          {m.service ? (
            <div>
              <dt className="text-xs text-white/40">Service interest</dt>
              <dd>{m.service}</dd>
            </div>
          ) : null}
          {m.budget ? (
            <div>
              <dt className="text-xs text-white/40">Budget</dt>
              <dd>{m.budget}</dd>
            </div>
          ) : null}
        </dl>
        <div>
          <p className="text-xs text-white/40">Message</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{m.message}</p>
        </div>
      </Card>

      <MessageActions id={m.id} status={m.status} note={m.internalNote} email={m.email} name={m.name} />
    </div>
  );
}
