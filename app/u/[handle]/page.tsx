import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DigitalCard } from '@/app/components/DigitalCard';
import { getPublicProfileByHandleAction } from '@/app/actions/profile';
import type { Metadata } from 'next';

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const card = await getPublicProfileByHandleAction(handle);
  if (!card) return { title: 'Not found · MsgNexus' };
  return {
    title: `${card.displayName} · MsgNexus`,
    description: card.headline || card.bio || `Digital card for ${card.displayName}`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const card = await getPublicProfileByHandleAction(handle);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        <DigitalCard card={card} />
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by{' '}
          <Link href="/" className="underline underline-offset-2 hover:text-foreground">
            MsgNexus.AI
          </Link>
        </p>
      </div>
    </div>
  );
}
