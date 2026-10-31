import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Check,
  CreditCard,
  Landmark,
  Plus,
  ReceiptText,
  Split,
  Trash2,
  UserRoundCheck,
  Wallet,
} from 'lucide-react';
import type { CartItem, Currency, PaymentMethod, PaymentSplit, Sale } from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useCashStore } from '@/store/useCashStore';
import { useSalesStore } from '@/store/useSalesStore';
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
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CURRENCY_SYMBOL,
  computeTotals,
  convertCurrency,
  formatMoney,
  formatNumber,
  round2,
  toNumber,
} from '@/utils/format';
import { cn } from '@/lib/utils';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  customerId: string | null;
  currency: Currency;
  exchangeRate: number;
  notes: string;
  proformaId?: string | null;
  onSuccess?: (sale: Sale) => void;
}

type SplitRow = { id: string; method: PaymentMethod; amount: string };

const methods: Array<{
  id: PaymentMethod;
  label: string;
  hint: string;
  icon: typeof Banknote;
}> = [
  { id: 'cash', label: 'Efectivo', hint: 'Caja / gaveta', icon: Banknote },
  { id: 'card', label: 'Tarjeta', hint: 'Débito / crédito', icon: CreditCard },
  { id: 'transfer', label: 'Transferencia', hint: 'Banco / billetera', icon: Landmark },
  { id: 'credit', label: 'Crédito', hint: 'Cuenta del cliente', icon: UserRoundCheck },
];

let rowCounter = 0;

export function PaymentDialog({
  open,
  onOpenChange,
  items,
  customerId,
  currency,
  exchangeRate,
  notes,
  proformaId,
  onSuccess,
}: PaymentDialogProps): React.JSX.Element {
  const customers = useCatalogStore((state) => state.customers);
  const cashSession = useCashStore((state) => state.current);
  const createSale = useSalesStore((state) => state.createSale);
  const settings = useSettingsStore((state) => state.settings);
  const customer = customers.find((entry) => entry.id === customerId) ?? null;

  const totals = useMemo(
    () =>
      computeTotals(
        items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          unitCost: item.unitCost,
        })),
      ),
    [items],
  );

  const [tab, setTab] = useState<'single' | 'split'>('single');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [payCurrency, setPayCurrency] = useState<Currency>(currency);
  const [cashReceived, setCashReceived] = useState('');
  const [rows, setRows] = useState<SplitRow[]>([
    { id: `row-${++rowCounter}`, method: 'cash', amount: '' },
  ]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const factor = payCurrency === 'USD' ? exchangeRate : 1;
  const displayTotal = convertCurrency(totals.total, payCurrency, exchangeRate);
  const displaySubtotal = convertCurrency(totals.subtotal, payCurrency, exchangeRate);
  const displayTax = convertCurrency(totals.tax, payCurrency, exchangeRate);
  const displayDiscount = convertCurrency(totals.discount, payCurrency, exchangeRate);

  const creditAvailable = customer ? round2(Math.max(0, customer.creditLimit - customer.balance)) : 0;

  useEffect(() => {
    if (!open) return;
    setTab('single');
    setMethod('cash');
    setPayCurrency(currency);
    setCashReceived('');
    setRows([{ id: `row-${++rowCounter}`, method: 'cash', amount: '' }]);
    setError('');
    setSubmitting(false);
  }, [open, currency]);

  const received = toNumber(cashReceived);
  const cashChange = method === 'cash' ? Math.max(0, round2(received - displayTotal)) : 0;
  const cashEnough = method !== 'cash' || received + 0.005 >= displayTotal;
  const cashBlocked = method === 'cash' && settings.cashDrawerRequired && !cashSession;

  const splitSumNio = round2(
    rows.reduce((acc, row) => acc + toNumber(row.amount) * factor, 0),
  );
  const splitRemainingNio = round2(totals.total - splitSumNio);
  const splitCreditNio = round2(
    rows
      .filter((row) => row.method === 'credit')
      .reduce((acc, row) => acc + toNumber(row.amount) * factor, 0),
  );
  const splitBalanced = Math.abs(splitRemainingNio) <= 0.05;
  const creditBlockedSingle = method === 'credit' && (!customer || totals.total > creditAvailable + 0.01);
  const creditBlockedSplit = splitCreditNio > 0 && (!customer || splitCreditNio > creditAvailable + 0.01);
  const splitCash = rows.some((row) => row.method === 'cash' && toNumber(row.amount) > 0);
  const splitCashBlocked = splitCash && settings.cashDrawerRequired && !cashSession;

  const quickAmounts = useMemo(() => {
    const values = new Set<number>();
    values.add(displayTotal);
    const step = payCurrency === 'NIO' ? 50 : 5;
    const roundedUp = Math.ceil(displayTotal / step) * step;
    values.add(roundedUp);
    values.add(roundedUp + step);
    if (payCurrency === 'NIO') {
      [100, 200, 500, 1000].forEach((value) => {
        if (value >= displayTotal) values.add(value);
      });
    } else {
      [20, 50, 100].forEach((value) => {
        if (value >= displayTotal) values.add(value);
      });
    }
    return Array.from(values)
      .filter((value) => value >= displayTotal - 0.005)
      .sort((a, b) => a - b)
      .slice(0, 5);
  }, [displayTotal, payCurrency]);

  const addSplitRow = (): void => {
    const remaining = Math.max(0, convertCurrency(splitRemainingNio, payCurrency, exchangeRate));
    setRows((state) => [
      ...state,
      { id: `row-${++rowCounter}`, method: 'cash', amount: remaining > 0 ? remaining.toFixed(2) : '' },
    ]);
  };

  const updateRow = (id: string, patch: Partial<SplitRow>): void => {
    setRows((state) => state.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string): void => {
    setRows((state) => (state.length > 1 ? state.filter((row) => row.id !== id) : state));
  };

  const buildPayments = (): { payments: PaymentSplit[]; change: number } => {
    if (tab === 'single') {
      if (method === 'credit') {
        return {
          payments: [{ method: 'credit', amount: totals.total, currency: payCurrency }],
          change: 0,
        };
      }
      return {
        payments: [{ method, amount: totals.total, currency: payCurrency }],
        change: round2(cashChange * factor),
      };
    }

    const parsed = rows
      .map((row) => ({
        method: row.method,
        amount: round2(toNumber(row.amount) * factor),
        currency: payCurrency,
      }))
      .filter((payment) => payment.amount > 0);

    if (parsed.length === 0) throw new Error('Agrega al menos una línea de pago.');
    const sum = round2(parsed.reduce((acc, payment) => acc + payment.amount, 0));
    const diff = round2(totals.total - sum);
    if (Math.abs(diff) > 0.05) {
      throw new Error('Los pagos divididos no cubren el total de la venta.');
    }
    const last = parsed[parsed.length - 1];
    last.amount = round2(last.amount + diff);
    return {
      payments: parsed,
      change: 0,
    };
  };

  const handleConfirm = (): void => {
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'single') {
        if (method === 'cash' && !cashEnough) throw new Error('El efectivo recibido es menor al total.');
        if (method === 'credit' && !customer) {
          throw new Error('Selecciona un cliente para registrar una venta a crédito.');
        }
        if (method === 'credit' && totals.total > creditAvailable + 0.01) {
          throw new Error(
            `Límite de crédito insuficiente. Disponible: ${formatMoney(creditAvailable, exchangeRate)}.`,
          );
        }
        if (cashBlocked) throw new Error('Abre la caja para cobrar en efectivo.');
      } else {
        if (!splitBalanced) throw new Error('Los pagos divididos deben cubrir el total exacto.');
        if (creditBlockedSplit) {
          throw new Error(
            `Límite de crédito insuficiente. Disponible: ${formatMoney(creditAvailable, exchangeRate)}.`,
          );
        }
        if (splitCashBlocked) throw new Error('Abre la caja para cobrar en efectivo.');
      }

      const { payments, change } = buildPayments();
      const sale = createSale({
        items,
        payments,
        change,
        currency: payCurrency,
        exchangeRate,
        customerId,
        notes,
        proformaId: proformaId ?? null,
      });

      toast.success(
        `Venta ${sale.invoiceNumber} completada`,
        `${customer?.name ?? 'Consumidor Final'} · ${formatMoney(sale.totals.total, exchangeRate)}${sale.change > 0 ? ` · Cambio ${formatMoney(sale.change, exchangeRate)}` : ''}`,
      );
      onSuccess?.(sale);
      onOpenChange(false);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'No se pudo completar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchCurrency = (code: Currency): void => {
    if (code === payCurrency) return;
    setRows((state) =>
      state.map((row) => ({
        ...row,
        amount:
          toNumber(row.amount) > 0
            ? round2((toNumber(row.amount) * factor) / (code === 'USD' ? exchangeRate : 1)).toFixed(2)
            : '',
      })),
    );
    setCashReceived((value) => {
      const parsed = toNumber(value);
      if (parsed <= 0) return '';
      return round2((parsed * factor) / (code === 'USD' ? exchangeRate : 1)).toFixed(2);
    });
    setPayCurrency(code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto p-0">
        <div className="border-b border-border px-6 pb-5 pt-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> Cobro de venta
                </DialogTitle>
                <DialogDescription>
                  {customer ? `${customer.name}${customer.businessName ? ` · ${customer.businessName}` : ''}` : 'Consumidor Final'}
                  {' · '}
                  {items.length} línea{items.length === 1 ? '' : 's'}
                </DialogDescription>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a pagar</p>
                <p className="num mt-0.5 text-2xl font-bold text-foreground">
                  {formatMoney(totals.total, payCurrency, exchangeRate)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Tasa C$ {exchangeRate.toFixed(2)} / $1
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
              {(['NIO', 'USD'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleSwitchCurrency(code)}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    payCurrency === code
                      ? 'bg-muted/40 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {CURRENCY_SYMBOL[code]} {code}
                </button>
              ))}
            </div>
            {customer ? (
              <Badge variant={creditAvailable > 0 ? 'info' : 'danger'}>
                Crédito disponible: {formatMoney(creditAvailable, exchangeRate)}
              </Badge>
            ) : (
              <Badge variant="secondary">Sin cliente asignado</Badge>
            )}
            {cashSession ? (
              <Badge variant="success">Caja abierta</Badge>
            ) : (
              <Badge variant="warning">Caja cerrada</Badge>
            )}
          </div>
        </div>

        <div className="px-6">
          <Tabs value={tab} onValueChange={(value) => setTab(value as 'single' | 'split')}>
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1">
                <ReceiptText /> Pago único
              </TabsTrigger>
              <TabsTrigger value="split" className="flex-1">
                <Split /> Pago dividido
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {methods.map((entry) => {
                  const Icon = entry.icon;
                  const active = method === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setMethod(entry.id)}
                      className={cn(
                        'relative rounded-lg border p-3 text-left transition-all',
                        active
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20 dark:border-blue-500/50 dark:bg-blue-500/10'
                          : 'border-border bg-muted/40 hover:border-slate-300 hover:bg-muted/60 dark:hover:border-slate-600',
                      )}
                    >
                      {active ? (
                        <Check className="absolute right-2 top-2 h-3 w-3 text-primary" />
                      ) : null}
                      <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                      <p className="mt-2 text-[11px] font-semibold">{entry.label}</p>
                      <p className="text-[9px] text-muted-foreground">{entry.hint}</p>
                    </button>
                  );
                })}
              </div>

              {method === 'cash' ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="cash-received">Efectivo recibido</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {CURRENCY_SYMBOL[payCurrency]}
                        </span>
                        <Input
                          id="cash-received"
                          inputMode="decimal"
                          value={cashReceived}
                          onChange={(event) => setCashReceived(event.target.value)}
                          placeholder={displayTotal.toFixed(2)}
                          className="h-11 pl-9 text-lg font-semibold"
                        />
                      </div>
                    </div>
                    <div className="sm:w-[180px]">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cambio</p>
                      <p
                        className={cn(
                          'num mt-1 text-2xl font-bold',
                          cashChange > 0 ? 'text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {CURRENCY_SYMBOL[payCurrency]} {formatNumber(cashChange, 2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {quickAmounts.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCashReceived(value.toFixed(2))}
                        className="num rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      >
                        {CURRENCY_SYMBOL[payCurrency]} {formatNumber(value, 2)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashReceived(displayTotal.toFixed(2))}
                      className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                    >
                      Monto exacto
                    </button>
                  </div>
                </div>
              ) : null}

              {method === 'card' || method === 'transfer' ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium">
                    {method === 'card' ? 'Cobro con tarjeta' : 'Transferencia bancaria'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Se registrará el total exacto de {formatMoney(totals.total, payCurrency, exchangeRate)}.
                    Confirma la transacción en el {method === 'card' ? 'POS bancario' : 'banco'} antes de continuar.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                      <p className="text-muted-foreground">Monto</p>
                      <p className="num mt-0.5 text-sm font-semibold">{formatMoney(displayTotal * factor, exchangeRate)}</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                      <p className="text-muted-foreground">Moneda</p>
                      <p className="mt-0.5 text-sm font-semibold">{payCurrency}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {method === 'credit' ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  {customer ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Límite de crédito</span>
                        <span className="num font-semibold">{formatMoney(customer.creditLimit, exchangeRate)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Saldo actual</span>
                        <span className="num font-semibold text-warning">{formatMoney(customer.balance, exchangeRate)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            customer.balance / Math.max(customer.creditLimit, 1) > 0.85
                              ? 'bg-destructive'
                              : 'bg-gradient-to-r from-primary to-info',
                          )}
                          style={{
                            width: `${Math.min(100, (customer.balance / Math.max(customer.creditLimit, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p
                        className={cn(
                          'text-[11px] leading-relaxed',
                          totals.total > creditAvailable ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {totals.total > creditAvailable
                          ? 'La venta supera el crédito disponible. El sistema bloqueará el cobro.'
                          : `Esta venta dejaría un saldo de ${formatMoney(customer.balance + totals.total, exchangeRate)}.`}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-warning">
                      Asigna un cliente con crédito habilitado desde el ticket para continuar.
                    </p>
                  )}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="split" className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="flex items-end gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                  <div className="w-[136px] shrink-0 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Método</Label>
                    <select
                      value={row.method}
                      onChange={(event) => updateRow(row.id, { method: event.target.value as PaymentMethod })}
                      className="h-9 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    >
                      {methods.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Monto ({CURRENCY_SYMBOL[payCurrency]})</Label>
                    <Input
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                      placeholder="0.00"
                      className="h-9 num text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    aria-label="Eliminar pago"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  Restante:{' '}
                  <span className={cn('num font-semibold', splitBalanced ? 'text-success' : 'text-warning')}>
                    {formatMoney(Math.max(0, splitRemainingNio), payCurrency, exchangeRate)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={addSplitRow}>
                    <Plus className="h-3.5 w-3.5" /> Agregar pago
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={splitBalanced}
                    onClick={() => {
                      const last = rows[rows.length - 1];
                      if (last) {
                        updateRow(last.id, {
                          amount: convertCurrency(splitRemainingNio, payCurrency, exchangeRate).toFixed(2),
                        });
                      }
                    }}
                  >
                    Completar restante
                  </Button>
                </div>
              </div>
              {splitCreditNio > 0 ? (
                <div className="rounded-md border border-primary/15 bg-primary/[0.06] px-3 py-2 text-[10px] text-primary">
                  Crédito aplicado: {formatMoney(splitCreditNio, exchangeRate)} · Disponible:{' '}
                  {formatMoney(creditAvailable, exchangeRate)}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-2 border-t border-border bg-muted/40 px-6 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-4">
            <div className="flex justify-between text-muted-foreground sm:block">
              <span>Subtotal</span>
              <p className="num font-medium text-foreground">{formatMoney(displaySubtotal * factor, exchangeRate)}</p>
            </div>
            <div className="flex justify-between text-muted-foreground sm:block">
              <span>IVA 15%</span>
              <p className="num font-medium text-foreground">{formatMoney(displayTax * factor, exchangeRate)}</p>
            </div>
            <div className="flex justify-between text-muted-foreground sm:block">
              <span>Descuento</span>
              <p className="num font-medium text-destructive">-{formatMoney(displayDiscount * factor, exchangeRate)}</p>
            </div>
            <div className="flex justify-between text-muted-foreground sm:block">
              <span>Total</span>
              <p className="num font-bold text-foreground">{formatMoney(totals.total, payCurrency, exchangeRate)}</p>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter className="mt-4 items-center sm:justify-between">
            <p className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
              <Banknote className="h-3 w-3" /> El efectivo se registra automáticamente en la caja activa.
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                loading={submitting}
                disabled={
                  cashBlocked ||
                  creditBlockedSingle ||
                  (tab === 'single' && method === 'cash' && !cashEnough) ||
                  (tab === 'split' && (!splitBalanced || creditBlockedSplit || splitCashBlocked))
                }
                className="flex-1 sm:min-w-[190px]"
              >
                Confirmar cobro · {formatMoney(totals.total, payCurrency, exchangeRate)}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
