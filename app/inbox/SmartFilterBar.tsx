'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SMART_PRESETS } from '@/lib/smart-filters';
import { cn } from '@/lib/utils';

export function SmartFilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get('q') || '').trim().toLowerCase();

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {SMART_PRESETS.map((p) => {
        const active =
          p.id === 'all'
            ? !q
            : q === p.query || q.includes(p.id) || (p.category && q.includes(p.category));
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              router.push(p.query ? `/inbox?q=${encodeURIComponent(p.query)}` : '/inbox');
            }}
            className={cn('filter-chip min-h-[36px]', active && 'active')}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
