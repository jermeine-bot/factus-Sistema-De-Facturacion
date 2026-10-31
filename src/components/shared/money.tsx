import type { Currency } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

interface MoneyProps {
  amount: number;
  currency?: Currency;
  className?: string;
  showCurrency?: boolean;
}

export function Money({ amount, currency, className, showCurrency = true }: MoneyProps): React.JSX.Element {
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const displayCurrency = useUIStore((state) => state.displayCurrency);
  const target = currency ?? displayCurrency;
  const formatted = formatMoney(amount, target, rate);
  const display = showCurrency ? formatted : formatted.replace(/^(C\$|\$)\s?/, '');
  return <span className={cn('num tabular-nums', className)}>{display}</span>;
}
