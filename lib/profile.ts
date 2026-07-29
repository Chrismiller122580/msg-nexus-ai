/** Profile handle validation and public DTO helpers. */

export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'compose',
  'dashboard',
  'help',
  'inbox',
  'login',
  'logout',
  'me',
  'onboarding',
  'profile',
  'root',
  'settings',
  'static',
  'support',
  'u',
  'user',
  'users',
  'www',
  'msgnexus',
]);

export type ProfileSocials = {
  linkedin?: string;
  x?: string;
  instagram?: string;
  calendar?: string;
  custom?: Array<{ label: string; url: string }>;
};

export type SendDefaults = {
  sms?: number;
  whatsapp?: number;
  telegram?: number;
};

export type ProfileRecord = {
  userId: number;
  handle: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  socials: ProfileSocials | null;
  theme: string;
  accentColor: string | null;
  isPublic: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showConnections: boolean;
  allowContactForm: boolean;
  defaultSendPlatform: string | null;
  sendDefaults: SendDefaults | null;
};

export type PublicCardData = {
  handle: string;
  displayName: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  socials: ProfileSocials;
  theme: string;
  accentColor?: string;
  showConnections: boolean;
  allowContactForm: boolean;
  availableChannels: string[];
};

/** Normalize user input to a handle candidate. */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function suggestHandleFromEmail(email: string): string {
  const local = email.split('@')[0] || 'user';
  let h = normalizeHandle(local);
  if (h.length < 3) h = `user-${h || 'me'}`;
  if (RESERVED_HANDLES.has(h)) h = `${h}-card`;
  return h.slice(0, 32);
}

export function validateHandle(handle: string): { ok: true; handle: string } | { ok: false; error: string } {
  const h = normalizeHandle(handle);
  if (h.length < 3) return { ok: false, error: 'Handle must be at least 3 characters.' };
  if (h.length > 32) return { ok: false, error: 'Handle must be 32 characters or fewer.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(h)) {
    return { ok: false, error: 'Use lowercase letters, numbers, and single hyphens only.' };
  }
  if (RESERVED_HANDLES.has(h)) return { ok: false, error: 'That handle is reserved.' };
  return { ok: true, handle: h };
}

export function publicCardUrl(handle: string, origin?: string): string {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://www.msgnexus.ai').replace(/\/$/, '');
  return `${base}/u/${normalizeHandle(handle)}`;
}

export function toPublicCard(
  profile: ProfileRecord,
  availableChannels: string[] = []
): PublicCardData | null {
  if (!profile.isPublic) return null;
  return {
    handle: profile.handle,
    displayName: profile.displayName?.trim() || profile.handle,
    headline: profile.headline || undefined,
    bio: profile.bio || undefined,
    avatarUrl: profile.avatarUrl || undefined,
    location: profile.location || undefined,
    websiteUrl: profile.websiteUrl || undefined,
    email: profile.showEmail ? profile.publicEmail || undefined : undefined,
    phone: profile.showPhone ? profile.publicPhone || undefined : undefined,
    socials: profile.socials || {},
    theme: profile.theme || 'brand',
    accentColor: profile.accentColor || undefined,
    showConnections: profile.showConnections,
    allowContactForm: profile.allowContactForm,
    availableChannels: profile.showConnections ? availableChannels : [],
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
