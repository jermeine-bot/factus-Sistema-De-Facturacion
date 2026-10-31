import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  icon?: ReactNode;
  accent?: 'blue' | 'emerald' | 'sky' | 'amber' | 'rose';
  footer?: ReactNode;
  className?: string;
}

const accents: Record<NonNullable<StatCardProps['accent']>, { icon: string; glow: string }> = {
  blue: { icon: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400', glow: '' },
  emerald: { icon: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400', glow: '' },
  sky: { icon: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400', glow: '' },
  amber: { icon: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400', glow: '' },
  rose: { icon: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400', glow: '' },
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent = 'blue',
  footer,
  className,
}: StatCardProps): React.JSX.Element {
  const tone = accents[accent];
  const TrendIcon = trend === undefined ? Minus : trend >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700',
        className,
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <p className="mt-2.5 truncate font-display text-[27px] font-bold leading-none tracking-tight">{value}</p>
        </div>
        {icon ? (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:h-4 [&_svg]:w-4', tone.icon)}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className="relative mt-3.5 flex min-h-[20px] items-center gap-2">
        {trend !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              trend >= 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {footer ? <div className="relative mt-3 border-t border-border pt-3">{footer}</div> : null}
    </div>
  );
}
