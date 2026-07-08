export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // GitHub Codespaces: after codespace move / domain name change,
  // browser uses the forwarded https URL. Auto-detect so magic links
  // and Gmail OAuth callbacks point to the correct current location.
  const codespaceName = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespaceName && forwardingDomain) {
    const port = process.env.PORT || '3000';
    return `https://${codespaceName}-${port}.${forwardingDomain}`;
  }
  return 'http://localhost:3000';
}

/** Use the browser's actual host (www vs apex) for OAuth redirect_uri. */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host)
    .split(',')[0]
    .trim();
  const proto = (
    request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '') ?? 'https'
  )
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}

export function getOAuthCallbackUrl(provider: string, appUrl?: string): string {
  const base = (appUrl ?? getAppUrl()).replace(/\/$/, '');
  return `${base}/api/auth/${provider}/callback`;
}
