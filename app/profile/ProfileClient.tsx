'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Share2,
  Trash2,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserShell } from '@/app/components/UserShell';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';
import { DigitalCard } from '@/app/components/DigitalCard';
import {
  checkHandleAvailableAction,
  deleteAccountAction,
  deleteAllMessagesAction,
  disconnectAllConnectionsAction,
  getMyProfileAction,
  upsertMyProfileAction,
  type ProfileUpdateInput,
} from '@/app/actions/profile';
import { getComposeOptions } from '@/app/actions/compose';
import type { ProfileRecord, ProfileSocials, PublicCardData, SendDefaults } from '@/lib/profile';
import { publicCardUrl, toPublicCard } from '@/lib/profile';

export function ProfileClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [composeOpts, setComposeOpts] = useState<Awaited<ReturnType<typeof getComposeOptions>> | null>(
    null
  );
  const [handleStatus, setHandleStatus] = useState<string>('');
  const [dangerConfirm, setDangerConfirm] = useState('');
  const [copied, setCopied] = useState(false);

  // form fields
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [location, setLocation] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [publicPhone, setPublicPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [calendar, setCalendar] = useState('');
  const [theme, setTheme] = useState('brand');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [isPublic, setIsPublic] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showConnections, setShowConnections] = useState(true);
  const [allowContactForm, setAllowContactForm] = useState(true);
  const [defaultSendPlatform, setDefaultSendPlatform] = useState<string>('');
  const [sendDefaults, setSendDefaults] = useState<SendDefaults>({});

  async function load() {
    const data = await getMyProfileAction();
    const p = data.profile;
    setProfile(p);
    setLoginEmail(data.email);
    setPublicUrl(data.publicUrl);
    setChannels(data.availableChannels);
    setHandle(p.handle);
    setDisplayName(p.displayName || '');
    setHeadline(p.headline || '');
    setBio(p.bio || '');
    setAvatarUrl(p.avatarUrl || '');
    setLocation(p.location || '');
    setWebsiteUrl(p.websiteUrl || '');
    setPublicEmail(p.publicEmail || data.email);
    setPublicPhone(p.publicPhone || '');
    const s = p.socials || {};
    setLinkedin(s.linkedin || '');
    setXUrl(s.x || '');
    setInstagram(s.instagram || '');
    setCalendar(s.calendar || '');
    setTheme(p.theme || 'brand');
    setAccentColor(p.accentColor || '#6366f1');
    setIsPublic(p.isPublic);
    setShowEmail(p.showEmail);
    setShowPhone(p.showPhone);
    setShowConnections(p.showConnections);
    setAllowContactForm(p.allowContactForm);
    setDefaultSendPlatform(p.defaultSendPlatform || '');
    setSendDefaults(p.sendDefaults || {});
    try {
      setComposeOpts(await getComposeOptions());
    } catch {
      /* optional */
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => router.replace('/login?redirect=/profile'));
  }, [router]);

  const preview: PublicCardData | null = useMemo(() => {
    if (!profile) return null;
    const socials: ProfileSocials = {
      linkedin: linkedin || undefined,
      x: xUrl || undefined,
      instagram: instagram || undefined,
      calendar: calendar || undefined,
    };
    return toPublicCard(
      {
        ...profile,
        handle: handle || profile.handle,
        displayName: displayName || profile.handle,
        headline,
        bio,
        avatarUrl: avatarUrl || null,
        location: location || null,
        websiteUrl: websiteUrl || null,
        publicEmail: publicEmail || null,
        publicPhone: publicPhone || null,
        socials,
        theme,
        accentColor,
        isPublic: true,
        showEmail,
        showPhone,
        showConnections,
        allowContactForm,
      },
      channels
    );
  }, [
    profile,
    handle,
    displayName,
    headline,
    bio,
    avatarUrl,
    location,
    websiteUrl,
    publicEmail,
    publicPhone,
    linkedin,
    xUrl,
    instagram,
    calendar,
    theme,
    accentColor,
    showEmail,
    showPhone,
    showConnections,
    allowContactForm,
    channels,
  ]);

  async function save(partial?: ProfileUpdateInput) {
    setSaving(true);
    try {
      const payload: ProfileUpdateInput = partial || {
        handle,
        displayName,
        headline,
        bio,
        avatarUrl: avatarUrl || null,
        location: location || null,
        websiteUrl: websiteUrl || null,
        publicEmail: publicEmail || null,
        publicPhone: publicPhone || null,
        socials: {
          linkedin: linkedin || undefined,
          x: xUrl || undefined,
          instagram: instagram || undefined,
          calendar: calendar || undefined,
        },
        theme,
        accentColor,
        isPublic,
        showEmail,
        showPhone,
        showConnections,
        allowContactForm,
        defaultSendPlatform: defaultSendPlatform || null,
        sendDefaults,
      };
      const r = await upsertMyProfileAction(payload);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Profile saved');
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function onHandleBlur() {
    if (!handle.trim()) return;
    const r = await checkHandleAvailableAction(handle);
    if (!r.ok) setHandleStatus(r.error);
    else setHandleStatus(`Available: @${r.handle}`);
  }

  function qrSrc(url: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  }

  if (loading || !profile) {
    return (
      <UserShell>
        <LoadingSpinner message="Loading profile..." />
      </UserShell>
    );
  }

  const shareUrl = publicCardUrl(handle || profile.handle);

  return (
    <UserShell>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 space-y-5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Your profile</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  One-stop identity, digital card, send defaults, and data controls.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    toast.success('Link copied');
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />} Copy link
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary text-sm inline-flex"
                >
                  <ExternalLink size={16} /> View card
                </a>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={saving}
                  onClick={() => save()}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save profile
                </button>
              </div>
            </div>

            {/* Identity */}
            <section className="card p-4 sm:p-6 space-y-3">
              <h2 className="font-semibold">Identity</h2>
              <Field label="Display name" value={displayName} onChange={setDisplayName} />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Public handle
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/u/</span>
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    onBlur={onHandleBlur}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
                {handleStatus && (
                  <p className="text-xs text-muted-foreground mt-1">{handleStatus}</p>
                )}
              </div>
              <Field label="Headline" value={headline} onChange={setHeadline} placeholder="Founder · Builder · …" />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <Field label="Avatar URL" value={avatarUrl} onChange={setAvatarUrl} placeholder="https://…" />
              <Field label="Location" value={location} onChange={setLocation} />
              <Field label="Website" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://…" />
            </section>

            {/* Contact */}
            <section className="card p-4 sm:p-6 space-y-3">
              <h2 className="font-semibold">Public contact</h2>
              <Field label="Public email" value={publicEmail} onChange={setPublicEmail} />
              <Field label="Public phone" value={publicPhone} onChange={setPublicPhone} placeholder="+1…" />
              <div className="flex flex-wrap gap-4 text-sm">
                <Toggle label="Show email on card" checked={showEmail} onChange={setShowEmail} />
                <Toggle label="Show phone on card" checked={showPhone} onChange={setShowPhone} />
              </div>
              <Field label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/in/…" />
              <Field label="X / Twitter" value={xUrl} onChange={setXUrl} placeholder="https://x.com/…" />
              <Field label="Instagram" value={instagram} onChange={setInstagram} />
              <Field label="Calendar link" value={calendar} onChange={setCalendar} placeholder="https://cal.com/…" />
            </section>

            {/* Send from */}
            <section className="card p-4 sm:p-6 space-y-3">
              <h2 className="font-semibold">Sending options</h2>
              <p className="text-sm text-muted-foreground">
                Defaults for Compose — pick which channel and connection you usually send from.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Default channel
                </label>
                <select
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  value={defaultSendPlatform}
                  onChange={(e) => setDefaultSendPlatform(e.target.value)}
                >
                  <option value="">None</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              {composeOpts && (
                <div className="grid sm:grid-cols-3 gap-3">
                  <ConnPick
                    label="SMS from"
                    options={composeOpts.sms}
                    value={sendDefaults.sms}
                    onChange={(id) => setSendDefaults((d) => ({ ...d, sms: id }))}
                  />
                  <ConnPick
                    label="WhatsApp from"
                    options={composeOpts.whatsapp}
                    value={sendDefaults.whatsapp}
                    onChange={(id) => setSendDefaults((d) => ({ ...d, whatsapp: id }))}
                  />
                  <ConnPick
                    label="Telegram chat"
                    options={composeOpts.telegram}
                    value={sendDefaults.telegram}
                    onChange={(id) => setSendDefaults((d) => ({ ...d, telegram: id }))}
                  />
                </div>
              )}
              <Link href="/compose" className="text-sm text-indigo-500 hover:underline">
                Open Compose with defaults →
              </Link>
            </section>

            {/* Privacy & card */}
            <section className="card p-4 sm:p-6 space-y-3">
              <h2 className="font-semibold">Card & privacy</h2>
              <div className="flex flex-wrap gap-4 text-sm">
                <Toggle label="Public page enabled" checked={isPublic} onChange={setIsPublic} />
                <Toggle label="Show channel badges" checked={showConnections} onChange={setShowConnections} />
                <Toggle label="Allow contact CTAs" checked={allowContactForm} onChange={setAllowContactForm} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Theme</label>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option value="brand">Brand</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Accent color
                  </label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background"
                  />
                </div>
              </div>
            </section>

            {/* Share */}
            <section className="card p-4 sm:p-6 space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Share2 size={16} /> Share your card
              </h2>
              <code className="block text-xs sm:text-sm break-all bg-muted rounded-xl p-3">{shareUrl}</code>
              <div className="flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc(shareUrl)} alt="QR code" className="rounded-xl border border-border w-[140px] h-[140px]" />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Scan or share this QR to open your public digital business card.</p>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={async () => {
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: displayName || handle,
                            text: headline || 'My MsgNexus card',
                            url: shareUrl,
                          });
                        } catch {
                          /* cancelled */
                        }
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success('Link copied');
                      }
                    }}
                  >
                    Share…
                  </button>
                </div>
              </div>
            </section>

            {/* Connections / data */}
            <section className="card p-4 sm:p-6 space-y-3">
              <h2 className="font-semibold">Data & connections</h2>
              <p className="text-sm text-muted-foreground">
                Manage OAuth apps in Settings. Use this hub for bulk cleanup.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/settings" className="btn btn-secondary text-sm">
                  Manage integrations
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={async () => {
                    if (!confirm('Disconnect all messaging connections?')) return;
                    const r = await disconnectAllConnectionsAction();
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success('All connections removed');
                      await load();
                    }
                  }}
                >
                  <Unplug size={14} /> Disconnect all
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={async () => {
                    if (!confirm('Delete all messages and insights? This cannot be undone.')) return;
                    const r = await deleteAllMessagesAction();
                    if (r.error) toast.error(r.error);
                    else toast.success(`Deleted ${r.deleted ?? 0} messages`);
                  }}
                >
                  <Trash2 size={14} /> Delete all messages
                </button>
              </div>
            </section>

            {/* Danger */}
            <section className="card p-4 sm:p-6 space-y-3 border-red-500/30 bg-red-500/5">
              <h2 className="font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account, profile, connections, and data. Type your email (
                <span className="font-medium text-foreground">{loginEmail}</span>), handle, or DELETE.
              </p>
              <input
                value={dangerConfirm}
                onChange={(e) => setDangerConfirm(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="Type to confirm"
              />
              <button
                type="button"
                className="btn text-sm bg-red-600 text-white hover:bg-red-700"
                onClick={async () => {
                  const r = await deleteAccountAction(dangerConfirm);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success('Account deleted');
                    router.replace('/');
                  }
                }}
              >
                Delete account forever
              </button>
            </section>
          </div>

          {/* Live preview */}
          <aside className="lg:w-[340px] shrink-0 lg:sticky lg:top-20 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Card preview
            </p>
            {preview && <DigitalCard card={preview} compact />}
            {!isPublic && (
              <p className="text-xs text-amber-600">Public page is off — only you see this preview.</p>
            )}
          </aside>
        </div>
      </div>
    </UserShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border"
      />
      {label}
    </label>
  );
}

function ConnPick({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: number; identifier: string }>;
  value?: number;
  onChange: (id: number | undefined) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <select
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        disabled={options.length === 0}
      >
        <option value="">{options.length ? 'Default' : 'Not connected'}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.identifier}
          </option>
        ))}
      </select>
    </div>
  );
}
