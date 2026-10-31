import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground [&_svg]:h-6 [&_svg]:w-6">
        <div className="absolute inset-0 rounded-xl bg-blue-500/[0.04]" />
        <span className="relative">{icon}</span>
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
