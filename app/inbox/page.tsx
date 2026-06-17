import { Suspense } from 'react';
import InboxClient from './InboxClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

export default function InboxPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading your inbox..." />}>
      <InboxClient />
    </Suspense>
  );
}