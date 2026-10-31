import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '@/store/useToastStore';
import { cn } from '@/lib/utils';
import type { ToastMessage } from '@/types';

const variantMap: Record<
  ToastMessage['variant'],
  { icon: typeof Info; className: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 dark:border-emerald-500/25',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: XCircle,
    className: 'border-rose-200 dark:border-rose-500/25',
    iconClass: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-200 dark:border-amber-500/25',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    className: 'border-sky-200 dark:border-sky-500/25',
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
};

export function Toaster(): React.JSX.Element {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2.5">
      {toasts.map((toast) => {
        const meta = variantMap[toast.variant];
        const Icon = meta.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-3.5 text-card-foreground shadow-lg animate-slide-up',
              meta.className,
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.iconClass)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Cerrar notificación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
