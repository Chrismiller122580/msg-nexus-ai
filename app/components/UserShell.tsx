'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  PenSquare,
  Settings,
  LogOut,
  Shield,
  Search,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MsgNexusLogo } from '@/app/components/MsgNexusLogo';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { getCurrentUserAction } from '@/app/actions/user';
import { logoutAction } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Messages', icon: Inbox },
  { href: '/compose', label: 'Compose', icon: PenSquare },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function UserShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (!u) {
        router.replace('/login?redirect=' + encodeURIComponent(pathname || '/dashboard'));
        return;
      }
      setEmail(u.email);
      setIsStaff(Boolean(u.isStaff));
    });
  }, [router, pathname]);

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname?.startsWith(href + '/');
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur safe-area-top">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-4">
          <MsgNexusLogo href="/dashboard" size="sm" />
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm min-h-[40px] transition-colors',
                  isActive(href)
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
            <Link
              href="/inbox?view=pulse"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm min-h-[40px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              Pulse
            </Link>
          </nav>

          <form
            className="hidden sm:flex flex-1 max-w-xs ml-auto"
            onSubmit={(e) => {
              e.preventDefault();
              const query = q.trim();
              router.push(query ? `/inbox?q=${encodeURIComponent(query)}` : '/inbox');
            }}
          >
            <label className="relative w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages…"
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm"
              />
            </label>
          </form>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto sm:ml-0">
            <ThemeToggle />
            {isStaff && (
              <Link href="/admin" className="btn btn-ghost text-xs min-h-[36px] px-2 hidden sm:inline-flex" title="Admin">
                <Shield size={16} />
              </Link>
            )}
            <span className="hidden lg:inline text-xs text-muted-foreground max-w-[10rem] truncate">{email}</span>
            <button
              type="button"
              className="btn btn-ghost text-xs min-h-[36px] px-2"
              title="Log out"
              onClick={async () => {
                await logoutAction();
                router.push('/');
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom nav — primary destinations */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur safe-area-bottom">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px]',
                isActive(href) ? 'text-indigo-500 font-medium' : 'text-muted-foreground'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
