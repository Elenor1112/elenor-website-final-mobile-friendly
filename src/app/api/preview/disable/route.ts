import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeInternalPath } from '@/lib/validation/url';

export function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '/';
  draftMode().disable();
  redirect(safeInternalPath(path));
}
