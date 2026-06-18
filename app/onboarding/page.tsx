"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORMS } from '../../lib/platforms';
import { PlatformId } from '../../lib/types';
import { saveConnectedAccounts, getConnectedAccounts, ConnectedAccountInput } from '../actions/onboarding';
import { getCurrentUserAction } from '../actions/user';
import { ThemeToggle } from '../components/ThemeToggle';
import { MsgNexusLogo } from '../components/MsgNexusLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';

const DEFAULT_ACCOUNTS: ConnectedAccountInput[] = [
  { platformId: 'email', identifier: 'personal@gmail.com' },
  { platformId: 'email', identifier: 'work@company.com' },
  { platformId: 'whatsapp', identifier: '+1 (555) 123-4567' },
  { platformId: 'sms', identifier: '+1 (555) 987-6543' },
];

export default function OnboardingPage() {
  const [accounts, setAccounts] = useState<ConnectedAccountInput[]>(DEFAULT_ACCOUNTS);
  const [newIdentifier, setNewIdentifier] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [userName, setUserName] = useState('there');
  const router = useRouter();

  useEffect(() => {
    async function init() {
      try {
        const user = await getCurrentUserAction();
        if (!user) {
          router.replace('/login?redirect=/onboarding');
          return;
        }

        setUserName(user.name || user.email.split('@')[0]);

        const existing = await getConnectedAccounts();
        if (existing.length > 0) {
          setAccounts(
            existing.map(({ platformId, identifier, label }: any) => ({
              platformId,
              identifier,
              label,
            }))
          );
        }
      } catch {
        router.replace('/login?redirect=/onboarding');
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, [router]);

  const accountsByPlatform = PLATFORMS.reduce(
    (acc, p) => {
      acc[p.id] = accounts.filter((a) => a.platformId === p.id);
      return acc;
    },
    {} as Record<PlatformId, ConnectedAccountInput[]>
  );

  const addAccount = () => {
    const trimmed = newIdentifier.trim();
    if (!trimmed) return;

    const exists = accounts.some(
      (a) => a.platformId === selectedPlatform && a.identifier.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error('This account is already added for that platform.');
      return;
    }

    setAccounts((prev) => [...prev, { platformId: selectedPlatform, identifier: trimmed }]);
    setNewIdentifier('');
  };

  const removeAccount = (platformId: PlatformId, identifier: string) => {
    setAccounts((prev) =>
      prev.filter((a) => !(a.platformId === platformId && a.identifier === identifier))
    );
  };

  const handleContinue = async () => {
    if (accounts.length === 0) {
      const proceed = window.confirm(
        "You haven't added any accounts. You can still explore with demo data. Continue anyway?"
      );
      if (!proceed) return;
    }

    setIsLoading(true);

    try {
      await saveConnectedAccounts(accounts);
      router.push('/inbox');
    } catch {
      toast.error('Failed to save connections. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await saveConnectedAccounts([]);
      router.push('/inbox');
    } catch {
      toast.error('Failed to continue. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return <LoadingSpinner message="Loading your account..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <MsgNexusLogo />
          <ThemeToggle />
        </div>

        <div className="max-w-2xl mb-9">
          <div className="uppercase text-xs tracking-[1px] text-muted-foreground mb-2 flex items-center gap-2">
            <Users size={14} /> Step 1 of 1
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Hey {userName.split(' ')[0]}, which apps do you want to connect?
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose the messaging platforms you use. We&apos;ll only show messages from the ones you connect.
            You can change this anytime later.
          </p>
        </div>

        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">
            {accounts.length} connected account{accounts.length !== 1 ? 's' : ''} across platforms
          </div>

          <div className="card p-5 mb-6">
            <div className="font-medium mb-3">Add a new account</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as PlatformId)}
                className="bg-input border border-input-border rounded-2xl px-4 py-2 text-sm flex-1"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAccount()}
                placeholder="e.g. john@gmail.com or +1 555-123-4567"
                className="bg-input border border-input-border rounded-2xl px-4 py-2 text-sm flex-[2]"
              />
              <button
                onClick={addAccount}
                disabled={!newIdentifier.trim()}
                className="btn btn-primary px-6 disabled:opacity-50"
              >
                Add Account
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You can connect multiple accounts for the same platform (e.g. two Gmails or two WhatsApp numbers).
            </p>
          </div>

          <div className="space-y-4">
            {PLATFORMS.map((platform) => {
              const platformAccounts = accountsByPlatform[platform.id] || [];
              if (platformAccounts.length === 0) return null;

              return (
                <div key={platform.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
                    <div className="font-medium">{platform.name}</div>
                    <div className="text-xs text-muted-foreground">({platformAccounts.length})</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {platformAccounts.map((acc) => (
                      <div
                        key={`${platform.id}-${acc.identifier}`}
                        className="inline-flex items-center gap-2 bg-muted border border-border rounded-2xl px-3 py-1 text-sm"
                      >
                        <span>{acc.identifier}</span>
                        {acc.label && <span className="text-muted-foreground">({acc.label})</span>}
                        <button
                          onClick={() => removeAccount(platform.id, acc.identifier)}
                          className="ml-1 text-muted-foreground hover:text-red-500"
                          aria-label={`Remove ${acc.identifier}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {accounts.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-2xl">
                No accounts added yet. Use the form above to connect your first account.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleContinue}
            disabled={isLoading}
            className="btn btn-primary w-full sm:w-auto px-10 py-3 text-base flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? 'Saving your choices...' : (
              <>
                Continue to your inbox <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            Skip for now (use demo data)
          </button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground max-w-md">
          In this demo we simulate the connections. In a real product we would securely connect via official APIs or web bridges.
        </p>
      </div>
    </div>
  );
}
