'use client';

import { ExternalLink, HelpCircle, ListOrdered, Lightbulb } from 'lucide-react';
import type { CancelGuide } from '@/lib/subscription-cancel';

export function SubscriptionCancelHelp({
  guide,
  compact,
}: {
  guide: CancelGuide;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-amber-500/25 bg-amber-500/5 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-2 mb-2">
        <HelpCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={compact ? 16 : 18} />
        <div className="min-w-0">
          <div className={`font-medium ${compact ? 'text-sm' : 'text-sm'}`}>
            Cancel {guide.displayName}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step-by-step guide based on messages in your inbox
          </p>
        </div>
      </div>

      {(guide.cancelUrl || guide.manageUrl) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {guide.cancelUrl && (
            <a
              href={guide.cancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-xs min-h-[36px] inline-flex items-center gap-1.5"
            >
              Open cancel page <ExternalLink size={13} />
            </a>
          )}
          {guide.manageUrl && guide.manageUrl !== guide.cancelUrl && (
            <a
              href={guide.manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-xs min-h-[36px] inline-flex items-center gap-1.5"
            >
              Manage account <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        <ListOrdered size={13} /> Steps
      </div>
      <ol className="list-decimal list-inside space-y-1.5 text-xs text-foreground/90 mb-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="leading-relaxed pl-0.5">
            {step}
          </li>
        ))}
      </ol>

      {guide.tips && guide.tips.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <Lightbulb size={13} /> Tips
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {guide.tips.map((tip, i) => (
              <li key={i} className="leading-relaxed flex gap-1.5">
                <span className="text-amber-600/80 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
