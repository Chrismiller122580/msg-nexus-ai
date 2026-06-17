import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MsgNexusLogoProps {
  size?: 'sm' | 'md';
  showText?: boolean;
  href?: string;
  className?: string;
}

const sizeStyles = {
  sm: { icon: 'w-8 h-8', text: 'text-xl', monogram: 'text-xs' },
  md: { icon: 'w-9 h-9', text: 'text-2xl', monogram: 'text-sm' },
} as const;

export function MsgNexusLogo({
  size = 'sm',
  showText = true,
  href,
  className,
}: MsgNexusLogoProps) {
  const styles = sizeStyles[size];

  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          styles.icon,
          'rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-400 to-fuchsia-400 flex items-center justify-center text-white shrink-0 font-bold',
          styles.monogram
        )}
      >
        MN
      </div>
      {showText && (
        <span className={cn('font-semibold tracking-tight', styles.text)}>
          MsgNexus<span className="text-muted-foreground">.AI</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
