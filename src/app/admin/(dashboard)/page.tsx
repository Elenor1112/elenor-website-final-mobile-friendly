import Link from 'next/link';
import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  caseStudies,
  contactMessages,
  faqs,
  media,
  posts,
  services,
  testimonials,
} from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { Badge, Card } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

async function collectStats() {
  const [
    postCounts,
    serviceCount,
    caseStudyCount,
    faqCount,
    testimonialCount,
    mediaCount,
    newMessages,
    recentPosts,
    recentWork,
    recentMessages,
  ] = await Promise.all([
    db.select({ status: posts.status, n: count() }).from(posts).groupBy(posts.status),
    db.select({ n: count() }).from(services),
    db.select({ n: count() }).from(caseStudies),
    db.select({ n: count() }).from(faqs),
    db.select({ n: count() }).from(testimonials),
    db.select({ n: count() }).from(media),
    db
      .select({ n: count() })
      .from(contactMessages)
      .where(eq(contactMessages.status, 'new')),
    db
      .select({ id: posts.id, title: posts.title, status: posts.status, updatedAt: posts.updatedAt })
      .from(posts)
      .orderBy(desc(posts.updatedAt))
      .limit(5),
    db
      .select({ id: caseStudies.id, slug: caseStudies.slug, client: caseStudies.client, status: caseStudies.status, updatedAt: caseStudies.updatedAt })
      .from(caseStudies)
      .orderBy(desc(caseStudies.updatedAt))
      .limit(5),
    db
      .select({
        id: contactMessages.id,
        name: contactMessages.name,
        service: contactMessages.service,
        status: contactMessages.status,
        createdAt: contactMessages.createdAt,
      })
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(5),
  ]);

  const byStatus = Object.fromEntries(postCounts.map((r) => [r.status, Number(r.n)]));
  return {
    posts: {
      draft: byStatus.draft ?? 0,
      scheduled: byStatus.scheduled ?? 0,
      published: byStatus.published ?? 0,
    },
    services: Number(serviceCount[0]?.n ?? 0),
    caseStudies: Number(caseStudyCount[0]?.n ?? 0),
    faqs: Number(faqCount[0]?.n ?? 0),
    testimonials: Number(testimonialCount[0]?.n ?? 0),
    media: Number(mediaCount[0]?.n ?? 0),
    newMessages: Number(newMessages[0]?.n ?? 0),
    recentPosts,
    recentWork,
    recentMessages,
  };
}

const fmt = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
  ' · ' +
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25">
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-white/50">{label}</p>
    </Link>
  );
}

export default async function AdminHomePage() {
  // Auth first: stats include message senders, so never load them unauthenticated.
  const user = await requireUser();
  const stats = await collectStats();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">
        Welcome back, {user.name.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm text-white/50">
        Everything on the public site is editable from here — changes go live instantly.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Published posts" value={stats.posts.published} href="/admin/posts" />
        <Stat
          label="Drafts & scheduled"
          value={stats.posts.draft + stats.posts.scheduled}
          href="/admin/posts?status=draft"
        />
        <Stat label="Services" value={stats.services} href="/admin/services" />
        <Stat label="Case studies" value={stats.caseStudies} href="/admin/work" />
        <Stat label="Media files" value={stats.media} href="/admin/media" />
        <Stat label="New messages" value={stats.newMessages} href="/admin/messages" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Recent posts</h2>
            <Link href="/admin/posts" className="text-xs text-brand-glow hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {stats.recentPosts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/posts/${p.id}`}
                  className="flex items-center justify-between gap-3 text-sm text-white/75 hover:text-white"
                >
                  <span className="truncate">{p.title}</span>
                  <Badge value={p.status} />
                </Link>
                <p className="text-xs text-white/35">{fmt(p.updatedAt)}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Recent projects</h2>
            <Link href="/admin/work" className="text-xs text-brand-glow hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {stats.recentWork.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/work/${c.id}`}
                  className="flex items-center justify-between gap-3 text-sm text-white/75 hover:text-white"
                >
                  <span className="truncate">{c.client}</span>
                  <Badge value={c.status} />
                </Link>
                <p className="text-xs text-white/35">{fmt(c.updatedAt)}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Inbox</h2>
            <Link href="/admin/messages" className="text-xs text-brand-glow hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {stats.recentMessages.length === 0 ? (
              <li className="text-sm text-white/40">No messages yet.</li>
            ) : (
              stats.recentMessages.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/messages/${m.id}`}
                    className="flex items-center justify-between gap-3 text-sm text-white/75 hover:text-white"
                  >
                    <span className="truncate">
                      {m.name}
                      {m.service ? <span className="text-white/40"> · {m.service}</span> : null}
                    </span>
                    <Badge value={m.status} />
                  </Link>
                  <p className="text-xs text-white/35">{fmt(m.createdAt)}</p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
