"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { requestMagicLinkAction } from '../actions/magic-link';
import { ThemeToggle } from '../components/ThemeToggle';
import { MsgNexusLogo } from '../components/MsgNexusLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error');
    const messages: Record<string, string> = {
      'missing-token': 'Sign-in link is missing a token.',
      'magic-link-expired': 'This link is invalid or has expired. Request a new one.',
      'magic-link-failed': 'Verification failed. Please request a new link.',
      'magic-link-db': 'Could not reach the database. Try again in a moment.',
    };
    if (err && messages[err]) setError(messages[err]);
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDevLink('');
    setMagicSent(false);

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestMagicLinkAction(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMagicSent(true);
      if (result.devLink) setDevLink(result.devLink);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between p-6">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block mb-6">
              <MsgNexusLogo size="md" href="/" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-2">We&apos;ll email you a secure sign-in link</p>
          </div>

          <div className="card p-8">
            {magicSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm">
                  {devLink
                    ? 'Development mode — click your sign-in link:'
                    : `Check your inbox at ${email} for a sign-in link (expires in 15 minutes).`}
                </p>
                {devLink && (
                  <a href={devLink} className="btn btn-primary w-full text-sm break-all">
                    Sign in now
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setMagicSent(false)}
                  className="text-xs text-muted-foreground underline"
                >
                  Send another link
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-input border border-input-border rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-accent"
                    required
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500" role="alert">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary w-full py-2.5 text-base disabled:opacity-70"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Sending link...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Mail size={16} /> Email me a sign-in link
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            New here? Enter your email — we&apos;ll create your account when you sign in.
          </p>
        </div>
      </div>
    </div>
  );
}