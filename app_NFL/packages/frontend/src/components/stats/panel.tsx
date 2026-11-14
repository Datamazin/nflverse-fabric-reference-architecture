import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

/** A titled card. The title row carries a short yard-line rule as its accent. */
export function Panel({ title, subtitle, className, children }: PanelProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground',
        className
      )}
      aria-label={title}
    >
      <header className="flex flex-col gap-100 border-b border-border px-500 pt-400 pb-300">
        <div className="flex items-center gap-200">
          <span aria-hidden className="h-400 w-100 rounded-sm bg-primary" />
          <h2 className="font-heading text-500 leading-500 font-semibold tracking-wide uppercase">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-200 leading-200 text-muted-foreground">{subtitle}</p>
        )}
      </header>
      <div className="min-h-0 flex-1 p-400">{children}</div>
    </section>
  );
}

/** Placeholder that reserves the real layout while a query runs. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-lg bg-muted', className)}
    />
  );
}

export function PanelMessage({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex h-full flex-col items-center justify-center gap-200 px-600 py-800 text-center text-300 leading-300',
        tone === 'error' ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {tone === 'error' && <AlertTriangle className="icon-size-400" aria-hidden />}
      {children}
    </div>
  );
}
