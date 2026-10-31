import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import type { Product } from '@/types';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { formatMoney, formatNumber, round2 } from '@/utils/format';
import { cn } from '@/lib/utils';

interface AdjustStockModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdjusted?: () => void;
}

const REASONS = [
  {
    label: 'Conteo físico',
    value: 'Conteo físico de inventario: diferencia entre sistema y existencia real.',
  },
  {
    label: 'Daño / merma',
    value: 'Producto dañado o merma detectada durante la revisión de anaquel.',
  },
  {
    label: 'Vencimiento',
    value: 'Retiro de unidades vencidas o próximas a vencer.',
  },
  {
    label: 'Robo / extravío',
    value: 'Diferencia por robo, extravío o faltante no explicado.',
  },
  {
    label: 'Error de digitación',
    value: 'Corrección de error de digitación en una carga o salida anterior.',
  },
];

export function AdjustStockModal({
  product,
  open,
  onOpenChange,
  onAdjusted,
}: AdjustStockModalProps): React.JSX.Element {
  const recordAdjustment = useInventoryStore((state) => state.recordAdjustment);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const [newStock, setNewStock] = useState('0');
  const [issuer, setIssuer] = useState(currentUser.name);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !product) return;
    setNewStock(String(product.stock));
    setIssuer(currentUser.name);
    setReason('');
    setError('');
  }, [open, product, currentUser.name]);

  if (!product) return <></>;

  const current = product.stock;
  const parsed = Number(newStock);
  const parsedValid = Number.isFinite(parsed) && parsed >= 0;
  const difference = parsedValid ? round2(parsed - current) : 0;
  const hasDifference = parsedValid && difference !== 0;
  const valid = parsedValid && hasDifference && issuer.trim().length > 0 && reason.trim().length > 0;
  const impact = round2(difference * product.cost);

  const adjustTarget = (delta: number): void => {
    const base = parsedValid ? parsed : current;
    setNewStock(String(Math.max(0, round2(base + delta))));
  };

  const handleConfirm = (): void => {
    setError('');
    try {
      if (!parsedValid) throw new Error('Ingresa un stock físico válido mayor o igual a cero.');
      if (!hasDifference) throw new Error('El stock nuevo debe ser distinto al stock actual.');
      if (!issuer.trim()) throw new Error('El nombre de quien autoriza es obligatorio.');
      if (!reason.trim()) throw new Error('La justificación del ajuste es obligatoria.');

      const adjustment = recordAdjustment({
        productId: product.id,
        newStock: parsed,
        issuer,
        reason,
      });

      toast.success(
        'Ajuste absoluto registrado',
        `${product.name}: ${formatNumber(adjustment.previousStock, 2)} → ${formatNumber(adjustment.newStock, 2)} ${product.unit} (${difference > 0 ? '+' : ''}${formatNumber(difference, 2)}).`,
      );
      onAdjusted?.();
      onOpenChange(false);
    } catch (adjustError) {
      setError(adjustError instanceof Error ? adjustError.message : 'No se pudo registrar el ajuste.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-warning/20 bg-warning/10 text-warning">
            <Lock className="h-5 w-5" />
          </div>
          <DialogTitle>Ajuste absoluto de inventario</DialogTitle>
          <DialogDescription>
            Reemplazo de existencias para <span className="font-medium text-foreground">{product.name}</span>.
            El valor ingresado fija el stock final: no suma ni resta unidades sobre el saldo actual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: `${product.accent}33`,
              backgroundColor: `${product.accent}10`,
              color: product.accent,
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{product.name}</p>
            <p className="text-[9px] text-muted-foreground">
              {product.sku} · {product.category} · {product.unit}
            </p>
          </div>
          <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-[9px] font-semibold text-warning">
            Evento crítico
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Stock actual</p>
            <p className="num mt-1 text-lg font-bold">
              {formatNumber(current, 2)}{' '}
              <span className="text-[10px] font-normal text-muted-foreground">{product.unit}</span>
            </p>
            <p className="mt-0.5 text-[9px] text-muted-foreground/70">según sistema</p>
          </div>

          <div className="hidden text-muted-foreground/50 sm:block">→</div>

          <div className="rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
            <p className="text-[9px] uppercase tracking-wider text-primary/80">Nuevo stock físico</p>
            <p className="num mt-1 text-lg font-bold text-primary">
              {parsedValid ? formatNumber(parsed, 2) : '—'}{' '}
              <span className="text-[10px] font-normal text-muted-foreground">{product.unit}</span>
            </p>
            <p className="mt-0.5 text-[9px] text-primary/60">valor absoluto</p>
          </div>

          <div className="hidden text-muted-foreground/50 sm:block">=</div>

          <div
            className={cn(
              'rounded-lg border p-3',
              difference > 0
                ? 'border-success/20 bg-success/[0.06] text-success'
                : difference < 0
                  ? 'border-destructive/20 bg-destructive/[0.06] text-destructive'
                  : 'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            <p className="text-[9px] uppercase tracking-wider opacity-80">Diferencia auditada</p>
            <p className="num mt-1 flex items-center gap-0.5 text-lg font-bold">
              {difference > 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : difference < 0 ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : null}
              {difference > 0 ? '+' : ''}
              {formatNumber(difference, 2)}
            </p>
            <p className="mt-0.5 text-[9px] opacity-60">
              {difference === 0 ? 'sin cambios' : difference > 0 ? 'entrada de inventario' : 'salida de inventario'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-warning/15 bg-warning/[0.05] px-3 py-2 text-[10px] leading-relaxed text-warning/80">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            Regla de reemplazo absoluto: el stock final será exactamente el valor ingresado. La diferencia
            de {formatNumber(difference, 2)} {product.unit} quedará registrada con impacto de{' '}
            <span className="num font-semibold">{formatMoney(impact, rate)}</span> al costo.
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-stock" className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-warning" />
              Nuevo stock absoluto ({product.unit}) <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustTarget(-5)} aria-label="Restar cinco">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                id="adjust-stock"
                type="number"
                min={0}
                step="0.01"
                value={newStock}
                onChange={(event) => setNewStock(event.target.value)}
                className="num h-11 flex-1 text-center text-xl font-semibold"
                autoFocus
              />
              <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustTarget(5)} aria-label="Sumar cinco">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground">
              Valor de inventario resultante:{' '}
              <span className="num font-semibold text-foreground">
                {formatMoney((parsedValid ? parsed : 0) * product.cost, rate)}
              </span>{' '}
              al costo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-issuer">
              Nombre de quien autoriza <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adjust-issuer"
              value={issuer}
              onChange={(event) => setIssuer(event.target.value)}
              placeholder="Nombre y apellido del responsable"
              className="h-9 text-xs"
            />
            <p className="text-[9px] text-muted-foreground">
              Se registrará como autorizante del reemplazo en la bitácora crítica.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">
              Justificación del ajuste <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => setReason(entry.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[9px] transition-colors',
                    reason === entry.value
                      ? 'border-warning/30 bg-warning/10 text-warning'
                      : 'border-border text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600 hover:text-foreground',
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <Textarea
              id="adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe el hallazgo, evidencia o referencia del conteo físico…"
              className="min-h-[76px] text-xs"
            />
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-success" />
          Operación irreversible dentro de la sesión · se envía a auditoría como evento crítico.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!valid}
            className="bg-gradient-to-b from-warning to-warning hover:from-warning hover:to-warning"
          >
            <Lock className="h-3.5 w-3.5" /> Confirmar reemplazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
