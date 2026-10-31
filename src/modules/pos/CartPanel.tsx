import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  FileText,
  Minus,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { CartItem, Currency } from '@/types';
import { usePOSStore } from '@/store/usePOSStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useCashStore } from '@/store/useCashStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductTypeBadge } from '@/components/shared/product-type-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CustomerPickerDialog } from '@/modules/pos/CustomerPickerDialog';
import {
  CURRENCY_SYMBOL,
  computeLineTotal,
  computeTotals,
  formatMoney,
  round2,
  toNumber,
} from '@/utils/format';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  onCheckout: () => void;
  onSaveProforma: () => void;
}

function PriceEditor({ value, onCommit }: { value: number; onCommit: (price: number) => void }): React.JSX.Element {
  const [draft, setDraft] = useState(value.toFixed(2));

  useEffect(() => {
    setDraft(value.toFixed(2));
  }, [value]);

  const commit = (): void => {
    const parsed = round2(Math.max(0, toNumber(draft, value)));
    setDraft(parsed.toFixed(2));
    onCommit(parsed);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
        C$
      </span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        aria-label="Precio de venta"
        className="num h-7 w-[78px] rounded border border-info/25 bg-info/[0.07] pl-6 pr-1.5 text-right text-[11px] font-semibold text-info focus:border-info/50 focus:outline-none"
      />
    </div>
  );
}

function CartLine({
  item,
  currency,
  rate,
  onChangeQuantity,
  onChangeDiscount,
  onChangePrice,
  onChangeDescription,
  onRemove,
  index,
}: {
  item: CartItem;
  currency: Currency;
  rate: number;
  onChangeQuantity: (quantity: number) => void;
  onChangeDiscount: (discount: number) => void;
  onChangePrice: (price: number) => void;
  onChangeDescription: (description: string) => void;
  onRemove: () => void;
  index: number;
}): React.JSX.Element {
  const line = computeLineTotal(item.quantity, item.unitPrice, item.discount);

  return (
    <div className="group rounded-lg border border-border bg-muted/40 p-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
          style={{
            borderColor: `${item.accent}33`,
            backgroundColor: `${item.accent}12`,
            color: item.accent,
          }}
        >
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold leading-tight">{item.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ProductTypeBadge type={item.type} />
                <span className="text-[9px] text-muted-foreground">{item.unitLabel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label={`Quitar ${item.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {item.type === 'floating' ? (
            <div className="mt-2 space-y-1.5">
              <input
                value={item.description ?? ''}
                onChange={(event) => onChangeDescription(event.target.value)}
                placeholder="Descripción del servicio…"
                className="h-7 w-full rounded border border-info/20 bg-info/[0.04] px-2 text-[10px] text-info placeholder:text-info/35 focus:border-info/45 focus:outline-none"
                aria-label="Descripción del servicio"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Precio</span>
                <PriceEditor value={item.unitPrice} onCommit={onChangePrice} />
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center rounded-md border border-border bg-muted/40">
              <button
                type="button"
                onClick={() => onChangeQuantity(item.quantity - 1)}
                className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                aria-label="Disminuir cantidad"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="num flex h-6 min-w-7 items-center justify-center px-1 text-[11px] font-semibold">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onChangeQuantity(item.quantity + 1)}
                className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                aria-label="Aumentar cantidad"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={item.discount}
                onChange={(event) => onChangeDiscount(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
                className="num h-6 w-9 rounded border border-border bg-muted/40 px-1 text-right text-[10px] focus:border-primary/40 focus:outline-none"
                aria-label="Descuento porcentual"
              />
              <span className="text-[9px] text-muted-foreground">%</span>
            </div>

            <div className="text-right">
              {item.discount > 0 ? (
                <p className="num text-[9px] text-muted-foreground line-through">
                  {formatMoney(line.gross, currency, rate)}
                </p>
              ) : null}
              <p className="num text-[13px] font-bold">{formatMoney(line.total, currency, rate)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartPanel({ onCheckout, onSaveProforma }: CartPanelProps): React.JSX.Element {
  const navigate = useNavigate();
  const items = usePOSStore((state) => state.items);
  const customerId = usePOSStore((state) => state.customerId);
  const currency = usePOSStore((state) => state.currency);
  const notes = usePOSStore((state) => state.notes);
  const proformaId = usePOSStore((state) => state.proformaId);
  const updateQuantity = usePOSStore((state) => state.updateQuantity);
  const updateDiscount = usePOSStore((state) => state.updateDiscount);
  const updatePrice = usePOSStore((state) => state.updatePrice);
  const updateDescription = usePOSStore((state) => state.updateDescription);
  const removeItem = usePOSStore((state) => state.removeItem);
  const setCustomer = usePOSStore((state) => state.setCustomer);
  const setCurrency = usePOSStore((state) => state.setCurrency);
  const setNotes = usePOSStore((state) => state.setNotes);
  const detachProforma = usePOSStore((state) => state.detachProforma);
  const clear = usePOSStore((state) => state.clear);

  const customers = useCatalogStore((state) => state.customers);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const cashDrawerRequired = useSettingsStore((state) => state.settings.cashDrawerRequired);
  const session = useCashStore((state) => state.current);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const customer = customers.find((entry) => entry.id === customerId) ?? null;
  const creditAvailable = customer ? round2(Math.max(0, customer.creditLimit - customer.balance)) : 0;

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

  const otherCurrency: Currency = currency === 'NIO' ? 'USD' : 'NIO';
  const unitCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const cashBlocked = cashDrawerRequired && !session;

  const safeQuantity = (lineId: string, quantity: number): void => {
    try {
      updateQuantity(lineId, quantity);
    } catch (error) {
      toast.error('No se pudo actualizar', error instanceof Error ? error.message : undefined);
    }
  };

  const safePrice = (lineId: string, price: number): void => {
    try {
      updatePrice(lineId, price);
    } catch (error) {
      toast.error('Precio no permitido', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <aside className="flex h-full max-h-[calc(100vh-6.5rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:sticky lg:top-[5.25rem]">
      <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <ShoppingCart className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-display text-[13px] font-semibold leading-none">Ticket actual</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
              {items.length} líneas · {unitCount} unidades
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded border border-border bg-muted/40 p-0.5">
            {(['NIO', 'USD'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={cn(
                  'rounded-sm px-2 py-1 text-[9px] font-bold transition-colors',
                  currency === code
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {CURRENCY_SYMBOL[code]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            disabled={items.length === 0}
            className="rounded p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            aria-label="Vaciar ticket"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {proformaId ? (
        <div className="flex items-center justify-between border-b border-primary/10 bg-primary/[0.06] px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-primary">
            <FileText className="h-3 w-3" /> Ticket cargado desde proforma
          </div>
          <button
            type="button"
            onClick={detachProforma}
            className="rounded p-0.5 text-primary/60 hover:bg-primary/10 hover:text-primary"
            aria-label="Desvincular proforma"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div className="border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-left transition-colors hover:border-slate-300 dark:hover:border-slate-600 hover:bg-muted/40"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold">{customer?.name ?? 'Consumidor Final'}</p>
            <p className="truncate text-[9px] text-muted-foreground">
              {customer?.businessName || customer?.taxId || 'Venta de contado'}
            </p>
          </div>
          {customer ? (
            <Badge variant={creditAvailable > 0 ? 'info' : 'danger'} className="shrink-0 text-[9px]">
              <BadgeCheck /> {formatMoney(creditAvailable, rate)}
            </Badge>
          ) : (
            <span className="text-[9px] text-muted-foreground">Cambiar</span>
          )}
        </button>
      </div>

      {cashBlocked ? (
        <button
          type="button"
          onClick={() => navigate('/caja')}
          className="flex items-center gap-2 border-b border-warning/10 bg-warning/[0.06] px-4 py-2 text-left text-[10px] text-warning transition-colors hover:bg-warning/10"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Caja cerrada. Abre caja para cobrar en efectivo.
        </button>
      ) : null}

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/40">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-transparent" />
              <ShoppingBasket className="relative h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="font-display text-sm font-semibold">El ticket está vacío</p>
            <p className="mt-1.5 max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
              Selecciona productos del catálogo. Los combos y presentaciones se descuentan
              automáticamente del inventario.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              <Badge variant="secondary">C$ / USD</Badge>
              <Badge variant="secondary">Pago dividido</Badge>
              <Badge variant="secondary">Crédito</Badge>
            </div>
          </div>
        ) : (
          items.map((item, index) => (
            <CartLine
              key={item.lineId}
              item={item}
              index={index}
              currency={currency}
              rate={rate}
              onChangeQuantity={(quantity) => safeQuantity(item.lineId, quantity)}
              onChangeDiscount={(discount) => updateDiscount(item.lineId, discount)}
              onChangePrice={(price) => safePrice(item.lineId, price)}
              onChangeDescription={(description) => updateDescription(item.lineId, description)}
              onRemove={() => removeItem(item.lineId)}
            />
          ))
        )}
      </div>

      <div className="border-t border-border bg-muted/40 px-3.5 py-3">
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Nota para la factura (opcional)…"
          className="mb-2.5 h-8 w-full rounded border border-border bg-muted/40 px-2.5 text-[10px] placeholder:text-muted-foreground/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          aria-label="Notas de la venta"
        />

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="num">{formatMoney(totals.subtotal, currency, rate)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>IVA incluido</span>
            <span className="num">{formatMoney(totals.tax, currency, rate)}</span>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between text-destructive">
              <span>Descuento</span>
              <span className="num">-{formatMoney(totals.discount, currency, rate)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-2.5 flex items-end justify-between border-t border-border pt-2.5">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="num font-display text-[26px] font-bold leading-tight">
              {formatMoney(totals.total, currency, rate)}
            </p>
            <p className="num text-[9px] text-muted-foreground">
              ≈ {formatMoney(totals.total, otherCurrency, rate)} · Tasa {rate.toFixed(2)}
            </p>
          </div>
          <Badge variant={cashBlocked ? 'warning' : 'success'} className="mb-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', cashBlocked ? 'bg-warning' : 'bg-success')} />
            {cashBlocked ? 'Caja cerrada' : 'Caja lista'}
          </Badge>
        </div>

        <Button
          className="mt-3 h-11 w-full text-sm"
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          <Wallet className="h-4 w-4" /> Cobrar {items.length > 0 ? formatMoney(totals.total, currency, rate) : ''}
        </Button>
        <Button
          variant="outline"
          className="mt-1.5 w-full"
          size="sm"
          disabled={items.length === 0}
          onClick={onSaveProforma}
        >
          <FileText className="h-3.5 w-3.5" /> Guardar como proforma
        </Button>
      </div>

      <CustomerPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={customerId}
        onSelect={setCustomer}
      />
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="¿Vaciar el ticket actual?"
        description="Se eliminarán todas las líneas, el cliente asignado y las notas. Esta acción no afecta el inventario."
        confirmLabel="Vaciar ticket"
        destructive
        onConfirm={clear}
      />
    </aside>
  );
}
