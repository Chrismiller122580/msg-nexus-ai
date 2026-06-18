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
