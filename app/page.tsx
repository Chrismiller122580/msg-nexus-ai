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
    { name: 'WhatsApp', color: '#25D366' },
    { name: 'Email', color: '#3B82F6' },
    { name: 'Slack', color: '#E01E5A' },
    { name: 'SMS', color: '#10B981' },
    { name: 'Telegram', color: '#229ED9' },
    { name: 'X / Twitter', color: '#000000' },
    { name: 'Discord', color: '#5865F2' },

  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MsgNexusLogo href="/" />
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link 
              href="/login" 
              className="btn btn-ghost text-sm"
            >
              Log in
            </Link>
            <Link 
              href="/login" 
              className="btn btn-primary text-sm"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm mb-6 text-muted-foreground">
          <Zap size={14} /> Unified messaging, one inbox
        </div>

        <h1 className="text-6xl md:text-7xl font-semibold tracking-tighter mb-6">
          Unify all your<br />messaging.<br />
          <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            AI that actually helps.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-xl text-muted-foreground mb-10">
          One inbox for WhatsApp, Email, Slack, SMS, Telegram, X, and Discord.
          Semantic search. Automatic detection of bills, subscriptions, and shopping.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/login" 
            className="btn btn-primary px-8 py-3 text-base flex items-center gap-2"
          >
            Start connecting apps <ArrowRight size={18} />
          </Link>
          <Link 
            href="#features" 
            className="btn btn-secondary px-8 py-3 text-base"
          >
            See how it works
          </Link>
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          No credit card required • Free plan available
        </div>
      </div>

      {/* Platform logos / preview */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="text-center mb-6 text-sm uppercase tracking-widest text-muted-foreground">
          Connect to the platforms you already use
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

      {/* Features */}
      <div id="features" className="border-t border-border bg-muted/30 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card p-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <MessageSquare className="text-indigo-500" size={22} />
              </div>
              <h3 className="font-semibold mb-2 text-lg">Unified Inbox</h3>
              <p className="text-muted-foreground text-sm">
                All your conversations from 8+ platforms in one beautiful, fast interface. 
                Search across everything with smart semantic understanding.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Search className="text-emerald-500" size={22} />
              </div>
              <h3 className="font-semibold mb-2 text-lg">Semantic Search</h3>
              <p className="text-muted-foreground text-sm">
                Type naturally: “Netflix bill”, “rent due this month”, or “Amazon headphones”. 
                Smart search finds the right messages instantly.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                <Zap className="text-amber-500" size={22} />
              </div>
              <h3 className="font-semibold mb-2 text-lg">AI Pulse</h3>
              <p className="text-muted-foreground text-sm">
                Automatically detects bills, recurring subscriptions, and shopping purchases. 
                See your monthly spend and upcoming payments at a glance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust / Privacy */}
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Shield size={16} /> Privacy first
        </div>
        <h2 className="text-3xl font-semibold tracking-tight mb-3">Your data stays yours.</h2>
        <p className="max-w-md mx-auto text-muted-foreground">
          Your messages and insights are stored securely. Export your data anytime.
        </p>

        <div className="mt-10">
          <Link 
            href="/login" 
            className="btn btn-primary px-8 py-3 text-base inline-flex items-center gap-2"
          >
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
