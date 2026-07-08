/** Plain HTML magic-link email — avoids React render issues in serverless. */
export function buildMagicLinkHtml(signInUrl: string, expiresMinutes = 15): string {
  const safeUrl = signInUrl.replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; padding: 32px 16px;">
    <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px 24px;">
      <h1 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 20px;">Sign in to MsgNexus</h1>
      <p style="color: #52525b; font-size: 15px; line-height: 24px; margin: 0 0 16px;">
        Click the button below to sign in. This link expires in ${expiresMinutes} minutes and can only be used once.
      </p>
      <p style="margin: 24px 0;">
        <a href="${safeUrl}" style="background: #6366f1; border-radius: 8px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block; padding: 12px 20px;">
          Sign in to MsgNexus
        </a>
      </p>
      <p style="color: #52525b; font-size: 15px; line-height: 24px; margin: 0 0 16px;">
        If you didn&apos;t request this email, you can safely ignore it.
      </p>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0 16px;" />
      <p style="color: #a1a1aa; font-size: 12px; line-height: 20px; margin: 0; word-break: break-all;">
        If the button doesn&apos;t work, copy this link into your browser:<br />${safeUrl}
      </p>
    </div>
  </body>
</html>`;
}