import { getAdminAnalytics } from '@/app/actions/admin/analytics';
import { AdminAnalyticsClient } from './AdminAnalyticsClient';

export default async function AdminAnalyticsPage() {
  const analytics = await getAdminAnalytics();
  return <AdminAnalyticsClient analytics={analytics} />;
}