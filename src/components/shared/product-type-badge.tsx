import type { ProductType } from '@/types';
import { PRODUCT_TYPE_META } from '@/utils/product';
import { cn } from '@/lib/utils';

interface ProductTypeBadgeProps {
  type: ProductType;
  className?: string;
  short?: boolean;
}

export function ProductTypeBadge({ type, className, short = true }: ProductTypeBadgeProps): React.JSX.Element {
  const meta = PRODUCT_TYPE_META[type];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        meta.tone,
        className,
      )}
      title={meta.description}
    >
      {short ? meta.short : meta.label}
    </span>
  );
}
