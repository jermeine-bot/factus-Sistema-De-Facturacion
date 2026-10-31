import { useMemo, useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { round2, toNumber } from '@/utils/format';

export default function CurrencyAdjustPage(): React.JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const updateExchangeRate = useSettingsStore((state) => state.updateExchangeRate);
  const displayCurrency = useUIStore((state) => state.displayCurrency);

  const [rate, setRate] = useState(settings.exchangeRate);
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState<'NIO' | 'USD'>('NIO');

  const converted = useMemo(() => {
    if (from === 'NIO') return round2(amount / (rate || 1));
    return round2(amount * (rate || 1));
  }, [amount, from, rate]);

  const handleSave = (): void => {
    try {
      updateExchangeRate(round2(rate));
    } catch (e) {
      // noop
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventario"
        title="Ajuste de monedas"
        description="Consulta y ajusta la tasa de cambio entre C$ (NIO) y USD. NIO es la moneda base."
        icon={<Coins className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Moneda base" value="NIO" hint="Córdoba nicaragüense" icon={<Coins />} accent="blue" />
        <StatCard label="Tasa actual" value={`C$ ${settings.exchangeRate.toFixed(2)}`} hint="Por 1 USD" icon={<Coins />} accent="sky" />
        <StatCard label="Visualización" value={displayCurrency} hint="Moneda en Topbar" icon={<Coins />} accent="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold">Configurar tasa</p>
          <div className="space-y-1.5">
            <Label>Tasa de cambio (C$ por USD)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(toNumber(e.target.value))}
              className="num"
            />
          </div>
          <Button size="sm" onClick={handleSave}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar tasa
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Los importes históricos no se alteran retroactivamente.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold">Vista previa de conversión</p>
          <div className="flex gap-2">
            {(['NIO', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFrom(c)}
                className={cn(
                  'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                  from === c ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Monto en {from}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(toNumber(e.target.value))}
              className="num"
            />
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-[10px] text-muted-foreground">Equivalente</p>
            <p className="num text-lg font-bold">
              {from === 'NIO' ? '$ ' : 'C$ '} {converted.toFixed(2)} {from === 'NIO' ? 'USD' : 'NIO'}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Redondeo a 2 decimales. USD se usa para visualización y cobro según reglas existentes.
          </p>
        </div>
      </div>
    </div>
  );
}