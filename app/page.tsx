"use client";

import React from 'react';
import Link from 'next/link';
import { 
  ArrowRight, MessageSquare, Search, Zap, Shield 
} from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle';
import { MsgNexusLogo } from './components/MsgNexusLogo';

export default function HomePage() {
  const platforms = [
    { name: 'Gmail', color: '#EA4335' },
    { name: 'Outlook', color: '#0078D4' },
    { name: 'WhatsApp', color: '#25D366' },
    { name: 'SMS', color: '#10B981' },
    { name: 'Slack', color: '#E01E5A' },
    { name: 'X', color: '#000000' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50 safe-area-top">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <MsgNexusLogo href="/" />
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link href="/login" className="btn btn-ghost text-sm min-h-[40px] px-2 sm:px-4">
              Log in
            </Link>
            <Link href="/login" className="btn btn-primary text-sm min-h-[40px] px-3 sm:px-4">
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Get started free</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm mb-6 text-muted-foreground">
          <Zap size={14} /> One inbox. Bills, threads, and search.
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tighter mb-6">
          Every message.<br />
          One place.<br />
          <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            Money you can see.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-xl text-muted-foreground mb-8 sm:mb-10">
          Gmail, Outlook, SMS, Slack, WhatsApp, and X in one inbox.
          Incremental sync. Thread grouping. Automatic bills and subscriptions.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login" className="btn btn-primary px-8 py-3 text-base flex items-center gap-2">
            Start connecting apps <ArrowRight size={18} />
          </Link>
          <Link href="#features" className="btn btn-secondary px-8 py-3 text-base">
            See how it works
          </Link>
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          No credit card required • Free plan available
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="text-center mb-6 text-sm uppercase tracking-widest text-muted-foreground">
          Connect the channels that matter now
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {platforms.map((p) => (
            <div 
              key={p.name} 
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-border bg-card text-sm"
            >
              <span 
                className="inline-block w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </div>
          ))}
        </div>
      </div>

      <div id="features" className="border-t border-border bg-muted/30 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="card p-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <MessageSquare className="text-indigo-500" size={22} />
              </div>
              <h3 className="font-semibold mb-2 text-lg">Unified inbox</h3>
              <p className="text-muted-foreground text-sm">
                Conversations collapse into threads. Duplicates across Gmail and SMS do not double-count.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Search className="text-emerald-500" size={22} />
              </div>
              <h3 className="font-semibold mb-2 text-lg">Semantic search</h3>
              <p className="text-muted-foreground text-sm">
                Type “Netflix bill” or “rent due”. Search stays flat so hits are not hidden inside a thread.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                <Zap className="text-amber-500" size={22} />
              </div>
              <h3 className="font-semibold mb-2 text-lg">AI Pulse</h3>
              <p className="text-muted-foreground text-sm">
                Detects bills and recurring charges. Incremental Gmail sync keeps Pulse current without a full mailbox pull.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Shield size={16} /> Privacy first
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">Your data stays yours.</h2>
        <p className="max-w-md mx-auto text-muted-foreground">
          Messages and insights live in your account. Export anytime.
        </p>

        <div className="mt-10">
          <Link href="/login" className="btn btn-primary px-8 py-3 text-base inline-flex items-center gap-2">
            Get started — it’s free <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        MsgNexus.AI
      </footer>
    </div>
  );
}
