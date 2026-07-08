/** Supports legacy Vercel typo GOOGLE_CLIENT_SECRETE until renamed in project settings. */
export function getGoogleClientSecret(): string | undefined {
  return (
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRETE?.trim() ||
    undefined
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && getGoogleClientSecret());
}