'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CreditCard, Plug, ScrollText,
  BarChart3, Key, Inbox, Settings, Shield,
} from 'lucide-react';
import { MsgNexusLogo } from '@/app/components/MsgNexusLogo';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/connections', label: 'Connections', icon: Plug },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/api', label: 'API keys', icon: Key },
];

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-accent" size={18} />
            <span className="font-semibold text-sm">Admin Portal</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  active ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-0.5">
          <Link href="/inbox" className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl">
            <Inbox size={18} /> Inbox
          </Link>
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl">
            <Settings size={18} /> Settings
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50">
          <MsgNexusLogo href="/admin" />
          <ThemeToggle />
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}