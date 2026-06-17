import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifyMagicLinkAction } from '@/app/actions/magic-link';

export default async function VerifyMagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-500">Missing sign-in token.</p>
        <Link href="/login" className="btn btn-primary">Back to login</Link>
      </div>
    );
  }

  const result = await verifyMagicLinkAction(token);

  if (result.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-500">{result.error}</p>
        <Link href="/login" className="btn btn-primary">Back to login</Link>
      </div>
    );
  }

  if ('onboarded' in result && result.onboarded) {
    redirect('/inbox');
  }
  redirect('/onboarding');
}
