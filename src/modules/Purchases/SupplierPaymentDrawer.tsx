import { useEffect, useMemo, useState } from 'react';
import { Banknote, HandCoins, History, Landmark, ReceiptText, Wallet } from 'lucide-react';
import { SideDrawer } from '@/components/shared/side-drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useProcurementStore } from '@/store/useProcurementStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { toast } from '@/store/useToastStore';
import { formatDateTime, formatMoney, round2, toNumber } from '@/utils/format';
import { cn } from '@/lib/utils';

interface SupplierPaymentDrawerProps {
  supplierId: string | null;
  open: boolean;
  onClose: () => void;
}

export function SupplierPaymentDrawer({
  supplierId,
  open,
  onClose,
}: SupplierPaymentDrawerProps): React.JSX.Element {
  const suppliers = useCatalogStore((state) => state.suppliers);
  const payments = useProcurementStore((state) => state.supplierPayments);
  const registerSupplierPayment = useProcurementStore((state) => state.registerSupplierPayment);
  const settings = useSettingsStore((state) => state.settings);
  const cashSession = useCashStore((state) => state.current);

  const supplier = suppliers.find((entry) => entry.id === supplierId) ?? null;
  const rate = settings.exchangeRate;
  const cashAvailable = cashSession ? sessionExpected(cashSession) : 0;

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer'>('transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setMethod('transfer');
    setReference('');
    setNotes('');
    setError('');
    setSubmitting(false);
  }, [open, supplierId]);

  const supplierPayments = useMemo(
    () =>
      payments
        .filter((payment) => payment.supplierId === supplierId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [payments, supplierId],
  );

  const parsedAmount = round2(toNumber(amount));
  const remaining = supplier ? round2(Math.max(0, supplier.balance - parsedAmount)) : 0;

  const setPercent = (percent: number): void => {
    if (!supplier) return;
    setAmount(String(round2(supplier.balance * percent)));
  };

  const handleSubmit = (): void => {
    if (!supplier) return;
    setError('');
    setSubmitting(true);
    try {
      const payment = registerSupplierPayment({
        supplierId: supplier.id,
        amount: parsedAmount,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      toast.success(
        'Abono registrado',
        `${formatMoney(payment.amount, rate)} a ${supplier.name}. Nuevo saldo ${formatMoney(remaining, rate)}.`,
      );
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar el abono.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={(value) => { if (!value) onClose(); }}
      title="Registrar abono"
      description={supplier ? `${supplier.name} · saldo pendiente ${formatMoney(supplier.balance, rate)}` : 'Selecciona un proveedor.'}
      icon={<HandCoins className="h-4 w-4 text-success" />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!supplier || supplier.balance <= 0}
          >
            <HandCoins className="h-4 w-4" /> Confirmar abono
          </Button>
        </div>
      }
    >
      {supplier ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">{supplier.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {supplier.contactName} · {supplier.category}
                </p>
              </div>
              <Badge variant={supplier.balance > 0 ? 'warning' : 'success'}>
                {supplier.balance > 0 ? 'Con saldo' : 'Al día'}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saldo actual</p>
                <p className="num mt-0.5 text-sm font-bold text-warning">
                  {formatMoney(supplier.balance, rate)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Después del abono</p>
                <p className={cn('num mt-0.5 text-sm font-bold', remaining > 0 ? 'text-foreground' : 'text-success')}>
                  {formatMoney(remaining, rate)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Monto del abono *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="num text-lg font-semibold"
            />
            <div className="flex flex-wrap gap-1.5">
              {[0.25, 0.5, 1].map((percent) => (
                <button
                  key={percent}
                  type="button"
                  onClick={() => setPercent(percent)}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"
                >
                  {percent === 1 ? 'Pagar todo' : `${percent * 100}%`}
                  <span className="num ml-1 text-[9px] text-muted-foreground/60">
                    {formatMoney(supplier.balance * percent, rate)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Forma de pago</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as 'cash' | 'transfer')}>
                <SelectTrigger className="h-9 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia bancaria</SelectItem>
                  <SelectItem value="cash">Efectivo de caja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Referencia</Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="TRF-000000"
                className="num h-9 text-xs"
              />
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
              method === 'cash' ? 'border-warning/20 bg-warning/[0.06]' : 'border-border bg-muted/40',
            )}
          >
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                {method === 'cash' ? (
                  <Banknote className="h-3.5 w-3.5 text-warning" />
                ) : (
                  <Landmark className="h-3.5 w-3.5 text-info" />
                )}
                {method === 'cash' ? 'Afecta la caja del día' : 'No afecta la caja'}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {method === 'cash'
                  ? `Efectivo disponible: ${formatMoney(cashAvailable, rate)}`
                  : 'Se concilia directamente con el banco.'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Acuerdo de pago, número de recibo o detalle de tesorería…"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          ) : null}

          <div className="border-t border-border pt-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="h-3 w-3" /> Abonos registrados
            </p>
            {supplierPayments.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-border px-3 py-3 text-[10px] text-muted-foreground">
                Este proveedor todavía no tiene abonos parciales.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {supplierPayments.slice(0, 4).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[10px] font-medium">
                        {payment.method === 'cash' ? (
                          <Wallet className="h-3 w-3 text-warning" />
                        ) : (
                          <Landmark className="h-3 w-3 text-info" />
                        )}
                        {payment.method === 'cash' ? 'Efectivo' : 'Transferencia'}
                        {payment.reference ? <span className="num text-muted-foreground">· {payment.reference}</span> : null}
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        {formatDateTime(payment.createdAt)} · {payment.userName}
                      </p>
                    </div>
                    <p className="num shrink-0 text-[11px] font-semibold text-success">
                      {formatMoney(payment.amount, rate)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-success/15 bg-success/[0.04] px-3 py-2 text-[10px] text-success/90">
            <ReceiptText className="mr-1 inline h-3 w-3" />
            El abono se aplica al saldo del proveedor y queda registrado en auditoría.
          </div>
        </div>
      ) : null}
    </SideDrawer>
  );
}
