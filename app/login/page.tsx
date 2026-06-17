"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { loginAction, type LoginResult } from '../actions/auth';
import { requestMagicLinkAction } from '../actions/magic-link';
import { ThemeToggle } from '../components/ThemeToggle';
import { MsgNexusLogo } from '../components/MsgNexusLogo';

type LoginMode = 'password' | 'magic';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const router = useRouter();

  const redirectAfterLogin = (result: LoginResult) => {
    if (result.onboarded) {
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      router.push(redirect?.startsWith('/') ? redirect : '/inbox');
    } else {
      router.push('/onboarding');
    }
  };

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await loginAction(loginEmail, loginPassword);
      if (result.error) {
        setError(result.error);
        return;
      }
      redirectAfterLogin(result);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'magic') {
      await handleMagicLink(e);
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    await handleLogin(email, password);
  };

  const handleDemoLogin = () => handleLogin('demo@msgnexus.ai', 'demo');

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
            <p className="text-muted-foreground mt-2">Sign in to manage your connected apps and inbox</p>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setMode('magic'); setError(''); setMagicSent(false); }}
              className={`btn flex-1 text-sm ${mode === 'magic' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Mail size={16} /> Magic link
            </button>
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); setMagicSent(false); }}
              className={`btn flex-1 text-sm ${mode === 'password' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Demo sign-in
            </button>
          </div>

          <div className="card p-8">
            {magicSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm">
                  {devLink
                    ? 'Development mode — click your sign-in link:'
                    : `Check your inbox at ${email} for a sign-in link (expires in 15 min).`}
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
              <form onSubmit={handleSubmit} className="space-y-5">
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

                {mode === 'password' && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                      Password <span className="text-muted-foreground font-normal">(any value for demo)</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-input border border-input-border rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-accent"
                      autoComplete="current-password"
                    />
                  </div>
                )}

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
                      {mode === 'magic' ? 'Sending link...' : 'Signing in...'}
                    </span>
                  ) : mode === 'magic' ? (
                    'Email me a sign-in link'
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            )}

            {!magicSent && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                  className="btn btn-secondary w-full py-2.5 text-base disabled:opacity-70"
                >
                  {isLoading ? 'Loading demo...' : 'Continue with Demo Account'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
