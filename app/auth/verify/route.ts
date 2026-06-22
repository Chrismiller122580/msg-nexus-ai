import { NextResponse } from 'next/server';
import { verifyMagicLinkToken } from '@/lib/verify-magic-link';
import { getAppUrl } from '@/lib/app-url';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const base = getAppUrl();

  if (!token) {
    return NextResponse.redirect(`${base}/login?error=missing-token`);
  }

  const result = await verifyMagicLinkToken(token);

  if (result.error) {
    const code =
      result.error.includes('invalid or has expired') ? 'magic-link-expired'
      : result.error.includes('Database') || result.error.includes('unreachable') ? 'magic-link-db'
      : 'magic-link-failed';
    return NextResponse.redirect(`${base}/login?error=${code}`);
  }

  const destination = result.onboarded ? '/inbox' : '/onboarding';
  return NextResponse.redirect(`${base}${destination}`);
}