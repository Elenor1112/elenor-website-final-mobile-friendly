import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { postCategories } from '@/db/schema';
import { PostForm, emptyPost } from '../PostForm';
import { requireUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'New post' };
export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  await requireUser();

  const categories = await db
    .select({ id: postCategories.id, name: postCategories.name })
    .from(postCategories)
    .orderBy(asc(postCategories.sortOrder));

  return <PostForm initial={emptyPost} categories={categories} />;
}
