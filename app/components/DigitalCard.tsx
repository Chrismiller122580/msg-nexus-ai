import {
  Calendar,
  Globe,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Smartphone,
} from 'lucide-react';
import type { PublicCardData } from '@/lib/profile';
import { initials } from '@/lib/profile';
import { cn } from '@/lib/utils';

export function DigitalCard({
  card,
  className,
  compact,
}: {
  card: PublicCardData;
  className?: string;
  compact?: boolean;
}) {
  const theme = card.theme || 'brand';
  const accent = card.accentColor || '#6366f1';
  const shell =
    theme === 'dark'
      ? 'bg-zinc-950 text-zinc-50 border-zinc-800'
      : theme === 'light'
        ? 'bg-white text-zinc-900 border-zinc-200'
        : 'bg-gradient-to-br from-indigo-500/15 via-background to-violet-500/10 text-foreground border-border';

  const phoneDigits = card.phone?.replace(/\D/g, '') || '';

  return (
    <div
      className={cn(
        'rounded-3xl border shadow-sm overflow-hidden',
        shell,
        compact ? 'p-5' : 'p-6 sm:p-8',
        className
      )}
    >
      <div className="flex items-start gap-4">
        {card.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatarUrl}
            alt=""
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-black/10 shrink-0"
          />
        ) : (
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-xl font-semibold text-white shrink-0"
            style={{ backgroundColor: accent }}
          >
            {initials(card.displayName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={cn('font-semibold tracking-tight', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>
            {card.displayName}
          </h1>
          {card.headline && (
            <p className="text-sm sm:text-base opacity-80 mt-1">{card.headline}</p>
          )}
          {card.location && (
            <p className="text-xs opacity-60 mt-2 inline-flex items-center gap-1">
              <MapPin size={12} /> {card.location}
            </p>
          )}
        </div>
      </div>

      {card.bio && (
        <p className={cn('text-sm opacity-80 leading-relaxed', compact ? 'mt-4' : 'mt-5')}>
          {card.bio}
        </p>
      )}

      {card.showConnections && card.availableChannels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {card.availableChannels.map((ch) => (
            <span
              key={ch}
              className="text-[11px] px-2 py-0.5 rounded-full border border-current/15 opacity-80"
            >
              {ch}
            </span>
          ))}
        </div>
      )}

      <div className={cn('grid gap-2', compact ? 'mt-4 grid-cols-1' : 'mt-6 grid-cols-1 sm:grid-cols-2')}>
        {card.phone && (
          <a
            href={`tel:${card.phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white min-h-[44px]"
            style={{ backgroundColor: accent }}
          >
            <Phone size={16} /> Call
          </a>
        )}
        {card.email && (
          <a
            href={`mailto:${card.email}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-current/20 px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-black/5"
          >
            <Mail size={16} /> Email
          </a>
        )}
        {card.phone && (
          <a
            href={`sms:${card.phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-current/20 px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-black/5"
          >
            <Smartphone size={16} /> Text
          </a>
        )}
        {phoneDigits && (
          <a
            href={`https://wa.me/${phoneDigits}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-current/20 px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-black/5"
          >
            <MessageCircle size={16} /> WhatsApp
          </a>
        )}
        {card.websiteUrl && (
          <a
            href={card.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-current/20 px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-black/5 sm:col-span-2"
          >
            <Globe size={16} /> Website
          </a>
        )}
      </div>

      {(card.socials.linkedin || card.socials.x || card.socials.instagram || card.socials.calendar) && (
        <div className="flex flex-wrap gap-3 mt-5 opacity-80">
          {card.socials.linkedin && (
            <a href={card.socials.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="inline-flex items-center gap-1 text-xs font-medium">
              <LinkIcon size={16} /> LinkedIn
            </a>
          )}
          {card.socials.x && (
            <a href={card.socials.x} target="_blank" rel="noreferrer" className="text-sm font-bold" aria-label="X">
              𝕏
            </a>
          )}
          {card.socials.instagram && (
            <a href={card.socials.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="inline-flex items-center gap-1 text-xs font-medium">
              <LinkIcon size={16} /> IG
            </a>
          )}
          {card.socials.calendar && (
            <a href={card.socials.calendar} target="_blank" rel="noreferrer" aria-label="Calendar">
              <Calendar size={18} />
            </a>
          )}
        </div>
      )}

      {card.socials.custom && card.socials.custom.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {card.socials.custom.map((c) => (
            <li key={c.url}>
              <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 opacity-80 hover:opacity-100">
                {c.label || c.url}
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] opacity-40 mt-6 text-center">@{card.handle}</p>
    </div>
  );
}
