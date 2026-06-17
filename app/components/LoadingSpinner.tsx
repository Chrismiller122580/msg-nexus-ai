import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ message = 'Loading...', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground', className)}>
      <Loader2 className="animate-spin" size={24} />
      <p className="text-sm">{message}</p>
    </div>
  );
}