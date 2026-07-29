import { Suspense } from 'react';
import { ComposeClient } from './ComposeClient';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

export default function ComposePage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading compose..." />}>
      <ComposeClient />
    </Suspense>
  );
}
