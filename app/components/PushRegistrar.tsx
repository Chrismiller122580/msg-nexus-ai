'use client';

import { useEffect } from 'react';

/** Registers the service worker once on the client (HTTPS / localhost). */
export function PushRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] register failed', err);
    });
  }, []);
  return null;
}
