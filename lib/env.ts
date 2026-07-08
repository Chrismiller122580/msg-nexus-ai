/** Allow on-screen magic links in local dev only when explicitly enabled. */
export function isDevMagicLinkAllowed(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    (process.env.ALLOW_DEV_MAGIC_LINK === 'true' || process.env.ALLOW_DEV_MAGIC_LINK === '1')
  );
}