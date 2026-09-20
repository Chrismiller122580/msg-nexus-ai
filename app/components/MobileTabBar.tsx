'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, LayoutDashboard, PenSquare, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/compose', label: 'Send', icon: PenSquare },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const APP_PREFIXES = ['/dashboard', '/inbox', '/compose', '/profile', '/settings'];

export function MobileTabBar() {
  const pathname = usePathname() || '';
  const visible = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!visible) return null;

  return (
    <nav
      className="app-tabbar md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 pt-2 min-h-[52px] text-[10px]',
                active ? 'text-indigo-500 font-medium' : 'text-muted-foreground'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
