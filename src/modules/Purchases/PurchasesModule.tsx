import { useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Eye,
  FileClock,
  HandCoins,
  Landmark,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { Purchase, PurchaseOrder, PurchaseOrderStatus } from '@/types';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useProcurementStore } from '@/store/useProcurementStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCashStore } from '@/store/useCashStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PurchaseComposer, type PurchaseDocumentMode, type PurchaseComposerPrefill } from '@/modules/Purchases/PurchaseComposer';
import { SupplierPaymentDrawer } from '@/modules/Purchases/SupplierPaymentDrawer';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyStat,
  formatNumber,
} from '@/utils/format';
import { cn } from '@/lib/utils';

type PurchasesTab = 'invoices' | 'orders' | 'payables';

const paymentMeta: Record<Purchase['paymentMethod'], { label: string; variant: 'success' | 'warning' | 'info'; icon: typeof Banknote }> = {
  cash: { label: 'Efectivo', variant: 'success', icon: Banknote },
  credit: { label: 'Crédito', variant: 'warning', icon: CreditCard },
  transfer: { label: 'Transferencia', variant: 'info', icon: Landmark },
};

const orderStatusMeta: Record<PurchaseOrderStatus, { label: string; variant: 'secondary' | 'info' | 'success' | 'danger' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  sent: { label: 'Enviada', variant: 'info' },
  received: { label: 'Recibida', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
};

interface ComposerState {
  open: boolean;
  mode: PurchaseDocumentMode;
  prefill?: PurchaseComposerPrefill;
}

export default function PurchasesModule(): React.JSX.Element {
  const purchases = usePurchaseStore((state) => state.purchases);
  const purchaseOrders = useProcurementStore((state) => state.purchaseOrders);
  const supplierPayments = useProcurementStore((state) => state.supplierPayments);
  const suppliers = useCatalogStore((state) => state.suppliers);
  const settings = useSettingsStore((state) => state.settings);
  const cashSession = useCashStore((state) => state.current);

  const rate = settings.exchangeRate;
  const [tab, setTab] = useState<PurchasesTab>('invoices');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [paymentSupplierId, setPaymentSupplierId] = useState<string | null>(null);

  const purchaseSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.type === 'purchase'),
    [suppliers],
  );

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthPurchases = purchases.filter((purchase) => new Date(purchase.createdAt) >= monthStart);
    const debt = purchaseSuppliers.reduce((acc, supplier) => acc + supplier.balance, 0);
    const pendingOrders = purchaseOrders.filter(
      (order) => order.status === 'draft' || order.status === 'sent',
    ).length;
    return {
      monthTotal: monthPurchases.reduce((acc, purchase) => acc + purchase.total, 0),
      monthCount: monthPurchases.length,
      debt,
      pendingOrders,
      cashPurchases: purchases.filter((purchase) => purchase.isCashDrawerExpense).length,
      receivedOrders: purchaseOrders.filter((order) => order.status === 'received').length,
    };
  }, [purchases, purchaseOrders, purchaseSuppliers]);

  const filteredPurchases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return purchases
      .filter((purchase) => {
        if (supplierFilter !== 'all' && purchase.supplierId !== supplierFilter) return false;
        if (!term) return true;
        return `${purchase.number} ${purchase.supplierName} ${purchase.invoiceRef} ${purchase.userName}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchases, search, supplierFilter]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return purchaseOrders
      .filter((order) => {
        if (supplierFilter !== 'all' && order.supplierId !== supplierFilter) return false;
        if (!term) return true;
        return `${order.number} ${order.supplierName} ${order.invoiceRef} ${order.userName}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchaseOrders, search, supplierFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedPurchases = filteredPurchases.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const detail = purchases.find((purchase) => purchase.id === detailId) ?? null;

  const payables = useMemo(
    () =>
      purchaseSuppliers
        .filter((supplier) => supplier.balance > 0)
        .map((supplier) => {
          const creditDocuments = purchases.filter(
            (purchase) =>
              purchase.supplierId === supplier.id && purchase.paymentMethod === 'credit',
          );
          const lastCredit = creditDocuments[0];
          return {
            supplier,
            documents: creditDocuments.length,
            lastCreditAt: lastCredit?.createdAt ?? null,
            payments: supplierPayments.filter((payment) => payment.supplierId === supplier.id),
          };
        })
        .sort((a, b) => b.supplier.balance - a.supplier.balance),
    [purchaseSuppliers, purchases, supplierPayments],
  );

  const openComposer = (mode: PurchaseDocumentMode, prefill?: PurchaseComposerPrefill): void => {
    setComposer({ open: true, mode, prefill });
  };

  const convertOrder = (order: PurchaseOrder): void => {
    openComposer('invoice', {
      supplierId: order.supplierId,
      orderId: order.id,
      invoiceRef: order.invoiceRef,
      items: order.items.map((line) => ({
        productId: line.productId,
        unitId: line.unitId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Abastecimiento"
        title="Compras, órdenes y cuentas por pagar"
        description="Emite facturas que actualizan stock, planifica órdenes de compra y controla abonos parciales con proveedores de inventario."
        icon={<Truck className="h-5 w-5" />}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Badge variant={cashSession ? 'success' : 'warning'} className="h-8 px-3">
              <Wallet className="h-3 w-3" />
              {cashSession ? 'Caja abierta' : 'Caja cerrada'}
            </Badge>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openComposer('order')}>
                <ClipboardList className="h-3.5 w-3.5" /> Nueva orden
              </Button>
              <Button size="sm" onClick={() => openComposer('invoice')}>
                <ReceiptText className="h-3.5 w-3.5" /> Nueva factura
              </Button>
            </div>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Compras del mes"
          value={formatMoneyStat(stats.monthTotal, rate)}
          hint={`${stats.monthCount} facturas recibidas`}
          icon={<ShoppingCartIcon />}
          accent="blue"
        />
        <StatCard
          label="Cuentas por pagar"
          value={formatMoneyStat(stats.debt, rate)}
          hint={`${payables.length} proveedores con saldo`}
          icon={<HandCoins />}
          accent="amber"
        />
        <StatCard
          label="Órdenes pendientes"
          value={String(stats.pendingOrders)}
          hint={`${stats.receivedOrders} recibidas históricamente`}
          icon={<ClipboardList />}
          accent="sky"
        />
        <StatCard
          label="Compras desde caja"
          value={String(stats.cashPurchases)}
          hint="Documentos que afectaron efectivo"
          icon={<Banknote />}
          accent="rose"
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => { setTab(value as PurchasesTab); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="invoices">
            <ReceiptText /> Facturas <span className="num text-[9px] text-muted-foreground">{purchases.length}</span>
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ClipboardList /> Órdenes <span className="num text-[9px] text-muted-foreground">{purchaseOrders.length}</span>
          </TabsTrigger>
          <TabsTrigger value="payables">
            <HandCoins /> Por pagar <span className="num text-[9px] text-muted-foreground">{payables.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
              <SearchInput
                value={search}
                onChange={(value) => { setSearch(value); setPage(1); }}
                placeholder="Buscar factura, proveedor o referencia…"
                className="w-full lg:max-w-xs"
              />
              <Select value={supplierFilter} onValueChange={(value) => { setSupplierFilter(value); setPage(1); }}>
                <SelectTrigger className="h-9 w-[210px] text-[11px]">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {purchaseSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <Search className="h-3.5 w-3.5" /> {filteredPurchases.length} documentos
              </div>
            </div>

            {paginatedPurchases.length === 0 ? (
              <EmptyState
                icon={<ReceiptText />}
                title="Sin facturas en este filtro"
                description="Registra una factura de compra para sumar stock y actualizar el costo base."
                action={<Button size="sm" onClick={() => openComposer('invoice')}><Plus /> Nueva factura</Button>}
              />
            ) : (
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Líneas</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Caja</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPurchases.map((purchase) => {
                    const meta = paymentMeta[purchase.paymentMethod];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                              <ReceiptText className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="num text-xs font-semibold">{purchase.number}</p>
                              <p className="text-[9px] text-muted-foreground">{formatDate(purchase.createdAt)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium">{purchase.supplierName}</p>
                          <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <Building2 className="h-2.5 w-2.5" /> {purchase.userName}
                          </p>
                        </TableCell>
                        <TableCell className="num py-2.5 text-[10px] text-muted-foreground">
                          {purchase.invoiceRef || '—'}
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px]">{purchase.items.length}</TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant={meta.variant}><Icon /> {meta.label}</Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {purchase.isCashDrawerExpense ? (
                            <Badge variant="danger">Salió de caja</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No aplica</span>
                          )}
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px] font-semibold">
                          {formatMoney(purchase.total, rate)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Button variant="ghost" size="icon-sm" onClick={() => setDetailId(purchase.id)} aria-label="Ver factura">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {filteredPurchases.length > pageSize ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                <span>Página {safePage} de {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Siguiente</Button>
                </div>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
              <SearchInput
                value={search}
                onChange={(value) => setSearch(value)}
                placeholder="Buscar orden, proveedor o referencia…"
                className="w-full lg:max-w-xs"
              />
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-9 w-[210px] text-[11px]">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {purchaseSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" /> {filteredOrders.length} órdenes
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList />}
                title="Sin órdenes en este filtro"
                description="Planifica la reposición con una orden de compra sin afectar el inventario."
                action={<Button size="sm" onClick={() => openComposer('order')}><Plus /> Nueva orden</Button>}
              />
            ) : (
              <Table className="min-w-[940px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Entrega esperada</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Líneas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const meta = orderStatusMeta[order.status];
                    const expected = new Date(order.expectedDate);
                    const overdue = order.status === 'sent' && expected.getTime() < Date.now();
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info">
                              <ClipboardList className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="num text-xs font-semibold">{order.number}</p>
                              <p className="text-[9px] text-muted-foreground">Creada {formatDate(order.createdAt)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium">{order.supplierName}</p>
                          <p className="text-[9px] text-muted-foreground">{order.notes || 'Sin instrucciones'}</p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={cn('flex items-center gap-1.5 text-[10px]', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                            <CalendarDays className="h-3 w-3" /> {formatDate(order.expectedDate)}
                          </span>
                          {overdue ? <p className="text-[9px] text-destructive">Entrega vencida</p> : null}
                        </TableCell>
                        <TableCell className="py-2.5"><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px]">{order.items.length}</TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px] font-semibold">
                          {formatMoney(order.total, rate)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {order.status === 'received' ? (
                            <Badge variant="success"><CheckCircle2 /> Facturada</Badge>
                          ) : order.status === 'cancelled' ? (
                            <Badge variant="danger"><XCircle /> Cancelada</Badge>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => convertOrder(order)}>
                                <ReceiptText className="h-3 w-3" /> Facturar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payables" className="space-y-3">
          <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <HandCoins className="h-4 w-4 text-warning" /> Proveedores con crédito
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Aplica abonos parciales y observa el saldo restante en tiempo real.
                  </p>
                </div>
                <Badge variant="warning">{payables.length} con saldo</Badge>
              </div>

              {payables.length === 0 ? (
                <EmptyState
                  icon={<HandCoins />}
                  title="Sin cuentas por pagar"
                  description="Todos los proveedores de inventario están al día."
                />
              ) : (
                <Table className="min-w-[780px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-right">Documentos</TableHead>
                      <TableHead>Último crédito</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.map(({ supplier, documents, lastCreditAt }) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-warning/20 bg-warning/10 text-warning">
                              <Building2 className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{supplier.name}</p>
                              <p className="text-[9px] text-muted-foreground">{supplier.category}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-[10px] text-muted-foreground">
                          {supplier.contactName}
                          <p className="num">{supplier.phone}</p>
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px]">{documents}</TableCell>
                        <TableCell className="py-2.5 text-[10px] text-muted-foreground">
                          {lastCreditAt ? formatDate(lastCreditAt) : '—'}
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-[12px] font-bold text-warning">
                          {formatMoney(supplier.balance, rate)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Button size="sm" variant="outline" onClick={() => setPaymentSupplierId(supplier.id)}>
                            <HandCoins className="h-3 w-3" /> Abonar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-warning/15 bg-warning/[0.05] p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning/90">
                  <FileClock className="h-3.5 w-3.5" /> Exposición total
                </p>
                <p className="num mt-2 font-display text-2xl font-bold text-warning">
                  {formatMoney(stats.debt, rate)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {payables.length} proveedores · {purchases.filter((purchase) => purchase.paymentMethod === 'credit').length} facturas a crédito
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-warning to-destructive"
                    style={{ width: `${Math.min(100, Math.max(8, payables.length * 14))}%` }}
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <HandCoins className="h-3.5 w-3.5 text-success" /> Abonos recientes
                  </p>
                  <Badge variant="secondary">{supplierPayments.length}</Badge>
                </div>
                {supplierPayments.length === 0 ? (
                  <p className="px-4 py-5 text-[10px] text-muted-foreground">Aún no hay abonos registrados.</p>
                ) : (
                  <div className="max-h-[360px] divide-y divide-border overflow-y-auto">
                    {supplierPayments.slice(0, 8).map((payment) => (
                      <div key={payment.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-medium">{payment.supplierName}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {formatDateTime(payment.createdAt)} · {payment.method === 'cash' ? 'Efectivo' : 'Transferencia'}
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
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(detail)} onOpenChange={(value) => { if (!value) setDetailId(null); }}>
        <DialogContent className="max-w-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-primary" /> {detail.number}
                </DialogTitle>
                <DialogDescription>
                  {detail.supplierName} · {formatDateTime(detail.createdAt)} · Ref. {detail.invoiceRef || '—'}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Presentación</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((line) => (
                      <TableRow key={`${line.productId}-${line.unitId}`}>
                        <TableCell className="py-2 text-[11px]">{line.name}</TableCell>
                        <TableCell className="py-2 text-[10px] text-muted-foreground">{line.unitLabel}</TableCell>
                        <TableCell className="num py-2 text-right text-[11px]">{formatNumber(line.quantity, 2)}</TableCell>
                        <TableCell className="num py-2 text-right text-[11px]">{formatMoney(line.unitCost, rate)}</TableCell>
                        <TableCell className="num py-2 text-right text-[11px] font-semibold">{formatMoney(line.total, rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                <div className="flex items-center justify-between">
                  <Badge variant={paymentMeta[detail.paymentMethod].variant}>{paymentMeta[detail.paymentMethod].label}</Badge>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total factura</p>
                    <p className="num text-lg font-bold text-primary">{formatMoney(detail.total, rate)}</p>
                  </div>
                </div>
                {detail.notes ? <p className="mt-2 text-[10px] text-muted-foreground">{detail.notes}</p> : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <PurchaseComposer
        open={Boolean(composer?.open)}
        initialMode={composer?.mode ?? 'invoice'}
        prefill={composer?.prefill}
        onClose={() => setComposer(null)}
        onCompleted={() => {
          setTab(composer?.mode === 'order' ? 'orders' : 'invoices');
        }}
      />

      <SupplierPaymentDrawer
        supplierId={paymentSupplierId}
        open={Boolean(paymentSupplierId)}
        onClose={() => setPaymentSupplierId(null)}
      />
    </div>
  );
}

function ShoppingCartIcon(): React.JSX.Element {
  return <PackageCheck className="h-4 w-4" />;
}
