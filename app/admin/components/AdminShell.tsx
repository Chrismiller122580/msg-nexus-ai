'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CreditCard, Plug, ScrollText,
  BarChart3, Key, Inbox, Settings, Shield, Webhook, ScanEye, Menu, X,
} from 'lucide-react';
import { MsgNexusLogo } from '@/app/components/MsgNexusLogo';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, type Permission } from '@/lib/permissions';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/admin': LayoutDashboard,
  '/admin/users': Users,
  '/admin/subscriptions': CreditCard,
  '/admin/connections': Plug,
  '/admin/audit': ScrollText,
  '/admin/analytics': BarChart3,
  '/admin/api': Key,
  '/admin/webhooks': Webhook,
  '/admin/userlens': ScanEye,
};

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: typeof ADMIN_NAV;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {nav.map(({ href, label }) => {
        const Icon = ICONS[href] || LayoutDashboard;
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]',
              active ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({
  children,
  adminEmail,
  role,
  permissions,
}: {
  children: React.ReactNode;
  adminEmail: string;
  role: string;
  permissions: Permission[];
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = ADMIN_NAV.filter((item) => permissions.includes(item.permission));

  // Lock body scroll while mobile nav is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const sidebarHeader = (
    <div className="p-5 border-b border-border">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="text-accent shrink-0" size={18} />
        <span className="font-semibold text-sm">Admin Portal</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
      <p className="text-xs text-accent/80 capitalize mt-0.5">{role}</p>
    </div>
  );

  const sidebarFooter = (
    <div className="p-3 border-t border-border space-y-0.5">
      <Link
        href="/dashboard"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-xl min-h-[44px]"
      >
        <Inbox size={18} className="shrink-0" /> Inbox
      </Link>
      <Link
        href="/settings"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-xl min-h-[44px]"
      >
        <Settings size={18} className="shrink-0" /> Settings
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-card flex-col shrink-0">
        {sidebarHeader}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLinks nav={nav} pathname={pathname} />
        </nav>
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] max-w-full bg-card border-r border-border flex flex-col shadow-xl safe-area-inset">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="text-accent shrink-0" size={18} />
                <span className="font-semibold text-sm truncate">Admin Portal</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-border">
              <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
              <p className="text-xs text-accent/80 capitalize mt-0.5">{role}</p>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              <NavLinks nav={nav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
            {sidebarFooter}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="h-14 border-b border-border flex items-center justify-between gap-3 px-3 sm:px-6 bg-card/50 sticky top-0 z-40 safe-area-top">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <MsgNexusLogo href="/admin" className="min-w-0" />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
