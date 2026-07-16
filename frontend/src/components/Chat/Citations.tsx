import { LinkIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Citation } from '@/types';

interface CitationsProps {
  citations: Citation[];
  className?: string;
}

export function Citations({ citations, className }: CitationsProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <details className={cn('group mt-3 rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-primary-700 dark:bg-primary-900/40', className)}>
      <summary className="cursor-pointer list-none text-sm font-medium text-primary-700 marker:hidden dark:text-primary-200">
        <span className="inline-flex items-center gap-2">
          Citations
          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs text-accent-700 dark:bg-accent-900 dark:text-accent-200">
            {citations.length}
          </span>
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        {citations.map((citation) => (
          <div
            key={citation.id}
            className="rounded-lg border border-primary-200 bg-white p-3 shadow-sm dark:border-primary-700 dark:bg-primary-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-primary-900 dark:text-primary-50">{citation.title}</h4>
                {citation.source ? (
                  <p className="mt-1 text-xs uppercase tracking-wide text-primary-500 dark:text-primary-400">
                    {citation.source}
                  </p>
                ) : null}
              </div>
              {citation.url ? (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-sm text-accent-600 transition hover:text-accent-500 dark:text-accent-300"
                >
                  <LinkIcon className="h-4 w-4" />
                  Open
                </a>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-primary-700 dark:text-primary-200">{citation.excerpt}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
