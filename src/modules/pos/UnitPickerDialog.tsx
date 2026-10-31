import { useEffect, useState } from 'react';
import { Boxes, Check, Minus, Plus, Scale } from 'lucide-react';
import type { Product } from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatMoney, formatNumber } from '@/utils/format';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getUnitAvailability } from '@/utils/product';
import { toast } from '@/store/useToastStore';
import { cn } from '@/lib/utils';

interface UnitPickerDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (unitId: string, quantity: number) => void;
}

export function UnitPickerDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: UnitPickerDialogProps): React.JSX.Element {
  const products = useCatalogStore((state) => state.products);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const [unitId, setUnitId] = useState('u-base');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    setUnitId(product.units[0]?.id ?? 'u-base');
    setQuantity(1);
  }, [product]);

  if (!product) return <></>;

  const selectedUnit = product.units.find((unit) => unit.id === unitId) ?? product.units[0];
  const available = getUnitAvailability(product, selectedUnit.id, products);

  const handleConfirm = (): void => {
    if (quantity <= 0) return;
    if (quantity > available) {
      toast.error('Stock insuficiente', `Solo quedan ${formatNumber(available, 2)} ${selectedUnit.abbreviation}.`);
      return;
    }
    onConfirm(selectedUnit.id, quantity);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-warning" /> Presentación de venta
          </DialogTitle>
          <DialogDescription>
            {product.name} maneja un solo inventario base. Elige la presentación y el sistema
            convierte automáticamente a {product.unit}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-warning/15 bg-warning/[0.05] px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Inventario base disponible</span>
            <span className="num font-semibold text-warning">
              {formatNumber(product.stock, 2)} {product.unit}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Costo por {product.unit}</span>
            <span className="num text-foreground/80">{formatMoney(product.cost, rate)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {product.units.map((unit) => {
            const active = unit.id === unitId;
            const unitAvailable = getUnitAvailability(product, unit.id, products);
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => {
                  setUnitId(unit.id);
                  setQuantity(1);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  active
                    ? 'border-warning/35 bg-warning/[0.08]'
                    : 'border-border bg-muted/40 hover:border-slate-300 dark:hover:border-slate-600',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md border',
                    active
                      ? 'border-warning/25 bg-warning/10 text-warning'
                      : 'border-border bg-muted/40 text-muted-foreground',
                  )}
                >
                  {active ? <Check className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{unit.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {unit.ratio === 1
                      ? `1 ${unit.abbreviation} = unidad base`
                      : `1 ${unit.abbreviation} = ${formatNumber(unit.ratio, 0)} ${product.unit}`}
                    {' · '}
                    {formatNumber(unitAvailable, 2)} disp.
                  </p>
                </div>
                <span className="num text-sm font-semibold">{formatMoney(unit.price, rate)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cantidad</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {formatNumber(quantity * selectedUnit.ratio, 2)} {product.unit} del inventario
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              aria-label="Disminuir"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <input
              type="number"
              value={quantity}
              min={1}
              step={1}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="num h-8 w-14 rounded-md border border-border bg-muted/40 text-center text-sm focus:border-warning/40 focus:outline-none"
              aria-label="Cantidad"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity((value) => value + 1)}
              aria-label="Aumentar"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={quantity > available || available <= 0}>
            Agregar · {formatMoney(selectedUnit.price * quantity, rate)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
