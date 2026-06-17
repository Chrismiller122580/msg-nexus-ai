import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'msgnexus-session';

function isServerAction(request: NextRequest): boolean {
  return request.method === 'POST' && request.headers.has('next-action');
}

export function proxy(request: NextRequest) {
  // Never redirect Server Action POSTs — auth is enforced inside each action
  if (isServerAction(request)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/inbox') || pathname.startsWith('/onboarding') || pathname.startsWith('/settings')) {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/inbox/:path*', '/onboarding/:path*', '/settings/:path*'],
};