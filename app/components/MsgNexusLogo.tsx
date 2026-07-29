import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MsgNexusLogoProps {
  size?: 'sm' | 'md';
  showText?: boolean;
  href?: string;
  className?: string;
}

const sizeStyles = {
  sm: { icon: 'w-8 h-8', text: 'text-xl' },
  md: { icon: 'w-9 h-9', text: 'text-2xl' },
} as const;

export function MsgNexusLogo({
  size = 'sm',
  showText = true,
  href,
  className,
}: MsgNexusLogoProps) {
  const styles = sizeStyles[size];

  // Geometric mark matches PWA/favicon (no font-dependent monogram in brand mark)
  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          styles.icon,
          'relative rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shrink-0 overflow-hidden shadow-sm'
        )}
        aria-hidden
      >
        <span className="absolute inset-[18%] rounded-[22%] bg-white/15" />
        <span className="absolute left-[18%] top-[28%] w-[52%] h-[36%] rounded-[28%] bg-white shadow-sm" />
        <span className="absolute left-[22%] bottom-[22%] w-[12%] h-[12%] rotate-45 bg-white" />
        <span className="absolute left-[26%] top-[38%] w-[28%] h-[6%] rounded-full bg-violet-400" />
        <span className="absolute left-[26%] top-[50%] w-[20%] h-[6%] rounded-full bg-violet-300" />
        <span className="absolute right-[16%] top-[18%] w-[18%] h-[18%] rounded-full bg-fuchsia-300 ring-2 ring-white" />
        <span className="absolute right-[24%] bottom-[20%] w-[12%] h-[12%] rounded-full bg-indigo-300 ring-1 ring-white" />
      </div>
      {showText && (
        <span className={cn('font-semibold tracking-tight truncate', styles.text)}>
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