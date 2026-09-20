'use client';

import { formatRelativeTime, cn } from '../../lib/utils';
import type { Message } from '../../lib/types';

export function ThreadCountChip({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="shrink-0 text-[10px] px-1.5 py-px rounded bg-muted tabular-nums">
      {count} in thread
    </span>
  );
}

export function ThreadRail({
  members,
  selectedId,
  onSelect,
}: {
  members: Message[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (members.length <= 1) return null;
  return (
    <div className="mt-4">
      <div className="uppercase text-xs tracking-widest text-muted-foreground mb-2">Thread</div>
      <div className="space-y-1">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              'w-full text-left text-xs px-3 py-2 rounded-xl border border-border min-h-[40px]',
              m.id === selectedId ? 'bg-muted' : 'hover:bg-muted/60'
            )}
          >
            <span className="font-medium">{formatRelativeTime(m.timestamp)}</span>
            <span className="text-muted-foreground"> · {m.platformId}</span>
            {m.subject ? <span className="block truncate mt-0.5">{m.subject}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
