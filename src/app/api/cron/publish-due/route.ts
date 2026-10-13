import { NextResponse } from 'next/server';
import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { revalidatePosts } from '@/lib/revalidate';
import { secretMatches } from '@/server/auth/secret';

// Daily Vercel Cron (vercel.json). Correctness never depends on this — public
// queries already treat due scheduled posts as live — but flipping the status
// keeps the admin tidy and refreshes sitemap/llms.txt lastModified data.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await db
    .update(posts)
    .set({ status: 'published', updatedAt: new Date() })
    .where(and(eq(posts.status, 'scheduled'), lte(posts.publishedAt, new Date())))
    .returning({ slug: posts.slug });

  for (const p of due) revalidatePosts(p.slug);
  if (due.length > 0) revalidatePosts();

  return NextResponse.json({ published: due.map((p) => p.slug) });
}
