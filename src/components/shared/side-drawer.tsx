import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Right-side modal used by dense operational flows. It keeps the underlying
 * list visible while the user edits a credit line, payment or team member.
 */
export function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  className,
}: SideDrawerProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'left-auto right-0 top-0 h-[100dvh] w-full max-w-lg translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-none border-y-0 border-r-0 border-l border-border bg-card p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className,
        )}
      >
        <div className="border-b border-border bg-muted/30 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {icon}
              {title}
            </DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="border-t border-border bg-muted/30 px-5 py-4">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
