import { Suspense } from 'react';
import SettingsClient from './SettingsClient';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading settings..." />}>
      <SettingsClient />
    </Suspense>
  );
}
