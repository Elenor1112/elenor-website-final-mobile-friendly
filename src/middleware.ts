import { NextResponse, type NextRequest } from 'next/server';

// Optimistic gate only: checks cookie *presence* so anonymous visitors never
// reach admin pages. Real session validation (DB-backed) happens server-side
// in the admin layout and inside every server action — never trust this alone.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login') return NextResponse.next();

  if (!request.cookies.has('admin_session')) {
    // Self-hosted behind a reverse proxy, request.url carries the server's
    // bind address (localhost), so build the redirect from the public host.
    const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
      ?.split(',')[0]
      .trim();
    const proto = (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol)
      .split(',')[0]
      .trim()
      .replace(/:$/, '');
    const url = new URL('/admin/login', host ? `${proto}://${host}` : request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
