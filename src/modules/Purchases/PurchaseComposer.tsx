import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  PackagePlus,
  Plus,
  ReceiptText,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import type { Purchase, PurchaseOrder } from '@/types';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useProcurementStore } from '@/store/useProcurementStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { toast } from '@/store/useToastStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, round2, toNumber } from '@/utils/format';
import { cn } from '@/lib/utils';

export type PurchaseDocumentMode = 'invoice' | 'order';

export interface PurchaseComposerPrefill {
  supplierId?: string;
  items?: Array<{
    productId: string;
    unitId: string;
    quantity: number;
    unitCost: number;
  }>;
  invoiceRef?: string;
  orderId?: string;
}

interface DraftLine {
  id: string;
  productId: string;
  unitId: string;
  quantity: number;
  unitCost: number;
}

interface PurchaseComposerProps {
  open: boolean;
  initialMode: PurchaseDocumentMode;
  prefill?: PurchaseComposerPrefill;
  onClose: () => void;
  onCompleted?: (result: Purchase | PurchaseOrder) => void;
}

let lineSeq = 0;

function blankLine(): DraftLine {
  return { id: `pl-${++lineSeq}`, productId: '', unitId: '', quantity: 1, unitCost: 0 };
}

function defaultExpectedDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function PurchaseComposer({
  open,
  initialMode,
  prefill,
  onClose,
  onCompleted,
}: PurchaseComposerProps): React.JSX.Element {
  const createPurchase = usePurchaseStore((state) => state.createPurchase);
  const createPurchaseOrder = useProcurementStore((state) => state.createPurchaseOrder);
  const receivePurchaseOrder = useProcurementStore((state) => state.receivePurchaseOrder);
  const products = useCatalogStore((state) => state.products);
  const suppliers = useCatalogStore((state) => state.suppliers);
  const settings = useSettingsStore((state) => state.settings);
  const cashSession = useCashStore((state) => state.current);

  const [docMode, setDocMode] = useState<PurchaseDocumentMode>(initialMode);
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Purchase['paymentMethod']>('credit');
  const [isCashDrawerExpense, setIsCashDrawerExpense] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [expectedDate, setExpectedDate] = useState(defaultExpectedDate());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rate = settings.exchangeRate;
  const purchaseSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.type === 'purchase' && supplier.isActive),
    [suppliers],
  );
  const purchaseProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.isActive && (product.type === 'common' || product.type === 'grouped'),
      ),
    [products],
  );
  const cashAvailable = cashSession ? sessionExpected(cashSession) : 0;

  useEffect(() => {
    if (!open) return;
    setDocMode(initialMode);
    setSupplierId(prefill?.supplierId ?? '');
    setPaymentMethod('credit');
    setIsCashDrawerExpense(false);
    setInvoiceRef(prefill?.invoiceRef ?? '');
    setExpectedDate(defaultExpectedDate());
    setNotes('');
    setFormError('');
    setSubmitting(false);
    setLines(
      prefill?.items && prefill.items.length > 0
        ? prefill.items.map((line) => ({ id: `pl-${++lineSeq}`, ...line }))
        : [blankLine()],
    );
  }, [open, initialMode, prefill]);

  useEffect(() => {
    if (paymentMethod !== 'cash') setIsCashDrawerExpense(false);
  }, [paymentMethod]);

  const total = round2(
    lines.reduce((acc, line) => {
      const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
      const unitCost = Number.isFinite(line.unitCost) ? line.unitCost : 0;
      return acc + quantity * unitCost;
    }, 0),
  );

  const addLine = (): void => setLines((state) => [...state, blankLine()]);

  const updateLine = (id: string, patch: Partial<DraftLine>): void => {
    setLines((state) => state.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const removeLine = (id: string): void => {
    setLines((state) => (state.length === 1 ? state : state.filter((line) => line.id !== id)));
  };

  const handleProductChange = (id: string, productId: string): void => {
    const product = purchaseProducts.find((entry) => entry.id === productId);
    if (!product) {
      updateLine(id, { productId, unitId: '', unitCost: 0 });
      return;
    }
    const unit = product.units[0];
    updateLine(id, {
      productId,
      unitId: unit.id,
      unitCost: round2(product.cost * unit.ratio),
    });
  };

  const handleUnitChange = (id: string, unitId: string): void => {
    const line = lines.find((entry) => entry.id === id);
    const product = purchaseProducts.find((entry) => entry.id === line?.productId);
    if (!product) return;
    const unit = product.units.find((entry) => entry.id === unitId) ?? product.units[0];
    updateLine(id, { unitId, unitCost: round2(product.cost * unit.ratio) });
  };

  const handleSubmit = (): void => {
    setFormError('');
    setSubmitting(true);
    try {
      if (!supplierId) throw new Error('Selecciona el proveedor del documento.');
      const validLines = lines
        .filter((line) => line.productId && line.quantity > 0)
        .map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitId: line.unitId,
          unitCost: line.unitCost,
        }));
      if (validLines.length === 0) {
        throw new Error('Agrega al menos un producto con cantidad válida.');
      }

      if (docMode === 'invoice') {
        const purchase = createPurchase({
          supplierId,
          items: validLines,
          paymentMethod,
          isCashDrawerExpense,
          invoiceRef: invoiceRef.trim(),
          notes: notes.trim(),
        });
        if (prefill?.orderId) {
          try {
            receivePurchaseOrder(prefill.orderId);
          } catch {
            // The order may already be received; the invoice is the source of truth.
          }
        }
        toast.success(
          `Factura ${purchase.number} registrada`,
          `${purchase.supplierName} · ${formatMoney(purchase.total, rate)} · stock actualizado`,
        );
        onCompleted?.(purchase);
      } else {
        const order = createPurchaseOrder({
          supplierId,
          items: validLines,
          expectedDate,
          invoiceRef: invoiceRef.trim(),
          notes: notes.trim(),
        });
        toast.success(
          `Orden ${order.number} creada`,
          `${order.supplierName} · entrega ${expectedDate} · sin afectar stock`,
        );
        onCompleted?.(order);
      }
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el documento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <div className="border-b border-border bg-muted/40 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {docMode === 'invoice' ? (
                <ReceiptText className="h-4 w-4 text-primary" />
              ) : (
                <ClipboardList className="h-4 w-4 text-info" />
              )}
              {docMode === 'invoice' ? 'Registrar factura de compra' : 'Crear orden de compra'}
            </DialogTitle>
            <DialogDescription>
              {docMode === 'invoice'
                ? 'La factura actualiza stock, costo base y, si aplica, afecta la caja del día.'
                : 'La orden compromete mercadería con el proveedor, pero no modifica existencias hasta facturarse.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setDocMode('invoice')}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  docMode === 'invoice'
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ReceiptText className="h-3.5 w-3.5" /> Factura de compra
              </button>
              <button
                type="button"
                onClick={() => setDocMode('order')}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  docMode === 'order'
                    ? 'bg-info/20 text-info shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ClipboardList className="h-3.5 w-3.5" /> Orden de compra
              </button>
            </div>
            <Badge variant={docMode === 'invoice' ? 'success' : 'info'}>
              {docMode === 'invoice' ? 'Actualiza stock' : 'No afecta stock'}
            </Badge>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Proveedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-9 text-[11px]">
                  <SelectValue placeholder="Proveedor de inventario" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{docMode === 'invoice' ? 'Factura del proveedor' : 'Referencia'}</Label>
              <Input
                value={invoiceRef}
                onChange={(event) => setInvoiceRef(event.target.value)}
                placeholder="FAC-0000"
                className="num h-9 text-xs"
              />
            </div>
            {docMode === 'order' ? (
              <div className="space-y-1.5">
                <Label>Entrega esperada *</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(event) => setExpectedDate(event.target.value)}
                  className="num h-9 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Forma de pago</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as Purchase['paymentMethod'])}
                >
                  <SelectTrigger className="h-9 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito proveedor</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {docMode === 'invoice' ? (
              <div
                className={cn(
                  'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
                  isCashDrawerExpense
                    ? 'border-warning/25 bg-warning/[0.07]'
                    : 'border-border bg-muted/40',
                )}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <Wallet className="h-3.5 w-3.5 text-warning" /> Sale de caja
                  </p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">
                    {paymentMethod === 'cash'
                      ? `Disponible ${formatMoney(cashAvailable, rate)}`
                      : 'Solo aplica a pagos en efectivo'}
                  </p>
                </div>
                <Switch
                  checked={isCashDrawerExpense}
                  disabled={paymentMethod !== 'cash'}
                  onCheckedChange={setIsCashDrawerExpense}
                  aria-label="Deducir compra desde la caja"
                />
              </div>
            ) : (
              <div className="rounded-md border border-info/15 bg-info/[0.05] px-3 py-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-info">
                  <CalendarDays className="h-3.5 w-3.5" /> Compromiso de compra
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  El stock se suma al registrar la factura.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-muted/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <Truck className="h-3.5 w-3.5 text-primary" /> Líneas del documento
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  El costo base se recalcula automáticamente según la presentación comprada.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Agregar línea
              </Button>
            </div>

            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo presentación</TableHead>
                  <TableHead className="text-right">Costo base</TableHead>
                  <TableHead className="text-right">Total línea</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const product = purchaseProducts.find((entry) => entry.id === line.productId);
                  const unit = product?.units.find((entry) => entry.id === line.unitId) ?? product?.units[0];
                  const ratio = unit?.ratio || 1;
                  const baseCost = round2((Number.isFinite(line.unitCost) ? line.unitCost : 0) / ratio);
                  const lineTotal = round2(
                    (Number.isFinite(line.quantity) ? line.quantity : 0) *
                      (Number.isFinite(line.unitCost) ? line.unitCost : 0),
                  );
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="py-2.5">
                        <Select
                          value={line.productId || undefined}
                          onValueChange={(value) => handleProductChange(line.id, value)}
                        >
                          <SelectTrigger className="h-8 w-[200px] text-[10px]">
                            <SelectValue placeholder="Seleccionar producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {purchaseProducts.map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Select
                          value={line.unitId || undefined}
                          onValueChange={(value) => handleUnitChange(line.id, value)}
                          disabled={!product}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-[10px]">
                            <SelectValue placeholder="Unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            {product?.units.map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: toNumber(event.target.value) })}
                          className="num ml-auto h-8 w-20 text-right text-[11px]"
                        />
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(event) => updateLine(line.id, { unitCost: toNumber(event.target.value) })}
                          className="num ml-auto h-8 w-24 text-right text-[11px]"
                        />
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <p className="num text-[10px] font-semibold">{formatMoney(baseCost, rate)}</p>
                        <p className="text-[8px] text-muted-foreground">/{product?.unit ?? 'unidad'}</p>
                      </TableCell>
                      <TableCell className="num py-2.5 text-right text-[11px] font-semibold">
                        {formatMoney(lineTotal, rate)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={lines.length === 1}
                          onClick={() => removeLine(line.id)}
                          aria-label="Eliminar línea"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-1.5">
              <Label>Notas internas</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder={
                  docMode === 'invoice'
                    ? 'Condiciones de recepción, transporte o diferencias de factura…'
                    : 'Instrucciones de entrega, contacto en bodega o condiciones pactadas…'
                }
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <PackagePlus className="h-3.5 w-3.5 text-primary" /> Resumen
              </div>
              <div className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Líneas</span>
                  <span className="num font-semibold">{lines.filter((line) => line.productId).length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="num font-semibold">{formatMoney(total, rate)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Impuesto</span>
                  <span className="num text-muted-foreground">C$ 0.00</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="num text-base font-bold text-primary">{formatMoney(total, rate)}</span>
                </div>
                {isCashDrawerExpense ? (
                  <p className="flex items-center gap-1 text-[9px] text-warning">
                    <Banknote className="h-3 w-3" /> Se descontará de la caja del día.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {formError ? (
            <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={submitting}>
            {docMode === 'invoice' ? (
              <>
                <ReceiptText className="h-4 w-4" /> Registrar factura
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4" /> Crear orden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
