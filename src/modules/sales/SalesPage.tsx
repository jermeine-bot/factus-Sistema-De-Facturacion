import { useMemo, useState } from 'react';
import {
  Ban,
  Banknote,
  CreditCard,
  Download,
  Eye,
  Landmark,
  MoreHorizontal,
  Printer,
  ReceiptText,
  Search,
  ShieldAlert,
  TrendingUp,
  UserRoundCheck,
} from 'lucide-react';
import type { PaymentMethod, Sale } from '@/types';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from '@/utils/format';

type DateRange = 'today' | '7d' | '30d' | 'all';
type StatusFilter = 'all' | 'completed' | 'void';

const methodMeta: Record<PaymentMethod, { label: string; icon: typeof Banknote }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  card: { label: 'Tarjeta', icon: CreditCard },
  transfer: { label: 'Transferencia', icon: Landmark },
  credit: { label: 'Crédito', icon: UserRoundCheck },
};

export default function SalesPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const voidSale = useSalesStore((state) => state.voidSale);
  const settings = useSettingsStore((state) => state.settings);
  const user = useSettingsStore((state) => state.currentUser);

  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRange>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);

  const rate = settings.exchangeRate;
  const canVoid = user.role === 'admin' || user.role === 'supervisor';

  const stats = useMemo(() => {
    const completed = sales.filter((sale) => sale.status === 'completed');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const todaySales = completed.filter((sale) => new Date(sale.createdAt) >= today);
    const monthSales = completed.filter((sale) => new Date(sale.createdAt) >= monthStart);
    const total = completed.reduce((acc, sale) => acc + sale.totals.total, 0);
    return {
      todayCount: todaySales.length,
      todayTotal: todaySales.reduce((acc, sale) => acc + sale.totals.total, 0),
      monthTotal: monthSales.reduce((acc, sale) => acc + sale.totals.total, 0),
      average: completed.length > 0 ? total / completed.length : 0,
      voided: sales.filter((sale) => sale.status === 'void').length,
    };
  }, [sales]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    if (range === '7d') start.setDate(start.getDate() - 7);
    if (range === '30d') start.setDate(start.getDate() - 30);

    return sales
      .filter((sale) => {
        if (term && !`${sale.invoiceNumber} ${sale.customerName} ${sale.userName}`.toLowerCase().includes(term)) return false;
        if (statusFilter !== 'all' && sale.status !== statusFilter) return false;
        if (methodFilter !== 'all' && !sale.payments.some((payment) => payment.method === methodFilter)) return false;
        if (range !== 'all' && new Date(sale.createdAt) < start) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, search, range, statusFilter, methodFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const detail = sales.find((sale) => sale.id === detailId) ?? null;

  const handleVoid = (sale: Sale): void => {
    try {
      voidSale(sale.id);
      toast.success(`Venta ${sale.invoiceNumber} anulada`, 'Inventario restaurado y crédito revertido.');
    } catch (error) {
      toast.error('No se pudo anular la venta', error instanceof Error ? error.message : undefined);
    }
  };

  const handleExport = (): void => {
    const rows: Array<Array<string | number>> = [
      ['Factura', 'Fecha', 'Cliente', 'Cajero', 'Ítems', 'Subtotal', 'IVA', 'Total', 'Métodos', 'Estado'],
      ...filtered.map((sale) => [
        sale.invoiceNumber,
        formatDateTime(sale.createdAt),
        sale.customerName,
        sale.userName,
        sale.items.length,
        sale.totals.subtotal,
        sale.totals.tax,
        sale.totals.total,
        sale.payments.map((payment) => methodMeta[payment.method].label).join(' + '),
        sale.status === 'completed' ? 'Completada' : 'Anulada',
      ]),
    ];
    downloadCsv(`ventas-factus-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Ventas exportadas', `${filtered.length} facturas en CSV.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Historial de ventas"
        description="Busca y revisa facturas, pagos y anulaciones del periodo."
        icon={<ReceiptText className="h-5 w-5" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Badge variant="secondary" className="h-8 px-3">
              {sales.length} facturas
            </Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas de hoy" value={formatMoney(stats.todayTotal, rate)} hint={`${stats.todayCount} facturas emitidas`} icon={<TrendingUp />} accent="blue" />
        <StatCard label="Facturado este mes" value={formatMoney(stats.monthTotal, rate)} hint="Solo ventas completadas" icon={<ReceiptText />} accent="emerald" />
        <StatCard label="Ticket promedio" value={formatMoney(stats.average, rate)} hint="Histórico de ventas válidas" icon={<Banknote />} accent="sky" />
        <StatCard label="Anulaciones" value={String(stats.voided)} hint="Requieren rol supervisor" icon={<ShieldAlert />} accent="rose" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar factura, cliente o cajero…"
            className="w-full lg:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(value) => { setRange(value as DateRange); setPage(1); }}>
            <SelectTrigger className="h-10 w-[165px] text-xs">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="all">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={(value) => { setMethodFilter(value as 'all' | PaymentMethod); setPage(1); }}>
            <SelectTrigger className="h-10 w-[175px] text-xs">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as StatusFilter); setPage(1); }}>
            <SelectTrigger className="h-10 w-[145px] text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
                <SelectItem value="void">Anuladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto hidden text-[10px] text-muted-foreground xl:block">
            {formatMoney(filtered.filter((sale) => sale.status === 'completed').reduce((acc, sale) => acc + sale.totals.total, 0), rate)} en el filtro
          </span>
        </div>

        {paginated.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No hay ventas que coincidan"
            description="Cambia el periodo o el término de búsqueda para ver otras facturas."
          />
        ) : (
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Métodos</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[50px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <button type="button" onClick={() => setDetailId(sale.id)} className="text-left">
                      <p className="num text-xs font-semibold text-primary hover:text-primary">{sale.invoiceNumber}</p>
                      <p className="text-[9px] text-muted-foreground">{formatDate(sale.createdAt)} · {sale.userName}</p>
                    </button>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-[170px] truncate text-[11px] font-medium">{sale.customerName}</p>
                    <p className="text-[9px] text-muted-foreground">{sale.isCashDrawer ? 'Afectó caja' : 'Sin efectivo'}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">{formatDateTime(sale.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {sale.payments.map((payment, index) => {
                        const meta = methodMeta[payment.method];
                        const Icon = meta.icon;
                        return (
                          <span
                            key={`${sale.id}-${payment.method}-${index}`}
                            title={`${meta.label}: ${formatMoney(payment.amount, rate)}`}
                            className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                          >
                            <Icon className="h-2.5 w-2.5" /> {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="num text-right text-[11px]">{sale.items.length}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(sale.totals.total, rate)}</TableCell>
                  <TableCell>
                    <Badge variant={sale.status === 'completed' ? 'success' : 'danger'}>
                      {sale.status === 'completed' ? 'Completada' : 'Anulada'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${sale.invoiceNumber}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{sale.invoiceNumber}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setDetailId(sale.id)}>
                          <Eye /> Ver factura
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDetailId(sale.id)}>
                          <Printer /> Imprimir
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canVoid || sale.status === 'void'}
                          className="text-destructive focus:text-destructive"
                          onClick={() => setVoidTarget(sale)}
                        >
                          <Ban /> Anular venta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-3">
          <p className="text-[10px] text-muted-foreground">
            Mostrando <span className="num text-foreground">{filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}</span> de{' '}
            <span className="num text-foreground">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Anterior
            </Button>
            <span className="num px-2 text-[10px] text-muted-foreground">{safePage} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto p-0">
          {detail ? (
            <>
              <div className="print-sheet relative overflow-hidden border-b border-border bg-muted/40 p-5">
                {detail.status === 'void' ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rotate-[-18deg] rounded border-2 border-destructive/40 px-6 py-2 text-2xl font-black uppercase tracking-widest text-destructive/30">
                      Anulada
                    </span>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-base font-bold">{settings.companyName}</p>
                    <p className="text-[10px] text-muted-foreground">{settings.legalName} · RUC {settings.rnc}</p>
                    <p className="text-[10px] text-muted-foreground">{settings.address}</p>
                    <p className="text-[10px] text-muted-foreground">{settings.phone} · {settings.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Factura comercial</p>
                    <p className="num mt-1 text-lg font-bold text-primary">{detail.invoiceNumber}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(detail.createdAt)}</p>
                    <Badge variant={detail.status === 'completed' ? 'success' : 'danger'} className="mt-1.5">
                      {detail.status === 'completed' ? 'Completada' : 'Anulada'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/40 p-3">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Cliente</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{detail.customerName}</p>
                    <p className="text-[9px] text-muted-foreground">{detail.customerId ? 'Cliente registrado' : 'Venta de contado'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Cajero / moneda</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{detail.userName}</p>
                    <p className="num text-[9px] text-muted-foreground">{detail.currency} · tasa {detail.exchangeRate.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-12 gap-2 border-b border-border pb-1.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="col-span-6">Descripción</span>
                    <span className="col-span-2 text-right">Cant.</span>
                    <span className="col-span-2 text-right">P. Unit.</span>
                    <span className="col-span-2 text-right">Total</span>
                  </div>
                  {detail.items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="grid grid-cols-12 gap-2 border-b border-border py-1.5 text-[10px]">
                      <div className="col-span-6 min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-[8px] text-muted-foreground">
                          {item.unitLabel}
                          {item.discount > 0 ? ` · ${item.discount}% desc.` : ''}
                          {item.description && item.description !== item.name ? ` · ${item.description}` : ''}
                        </p>
                      </div>
                      <span className="num col-span-2 text-right">{formatNumber(item.quantity, 2)}</span>
                      <span className="num col-span-2 text-right">{formatMoney(item.unitPrice, detail.exchangeRate)}</span>
                      <span className="num col-span-2 text-right font-semibold">{formatMoney(item.total, detail.exchangeRate)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div className="max-w-[240px] space-y-1">
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Pagos registrados</p>
                    {detail.payments.map((payment, index) => {
                      const meta = methodMeta[payment.method];
                      return (
                        <div key={`${payment.method}-${index}`} className="flex items-center justify-between text-[9px]">
                          <span className="text-muted-foreground">{meta.label}</span>
                          <span className="num">{formatMoney(payment.amount, detail.exchangeRate)}</span>
                        </div>
                      );
                    })}
                    {detail.change > 0 ? (
                      <div className="flex items-center justify-between text-[9px] text-warning">
                        <span>Cambio entregado</span>
                        <span className="num">{formatMoney(detail.change, detail.exchangeRate)}</span>
                      </div>
                    ) : null}
                    <div className="pt-1 text-[8px] text-muted-foreground">
                      {detail.proformaId ? 'Conversión de proforma · ' : ''}
                      {detail.notes || 'Sin notas adicionales.'}
                    </div>
                  </div>
                  <div className="w-full space-y-1 sm:w-[220px]">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="num">{formatMoney(detail.totals.subtotal, detail.exchangeRate)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>IVA incluido</span>
                      <span className="num">{formatMoney(detail.totals.tax, detail.exchangeRate)}</span>
                    </div>
                    {detail.totals.discount > 0 ? (
                      <div className="flex justify-between text-[10px] text-destructive">
                        <span>Descuento</span>
                        <span className="num">-{formatMoney(detail.totals.discount, detail.exchangeRate)}</span>
                      </div>
                    ) : null}
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold">Total</span>
                      <span className="num text-lg font-bold">{formatMoney(detail.totals.total, detail.exchangeRate)}</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 border-t border-border pt-2 text-center text-[8px] leading-relaxed text-muted-foreground/60">
                  {settings.footerMessage}
                </p>
              </div>

              <DialogFooter className="p-4 print-hidden">
                <Button variant="ghost" onClick={() => setDetailId(null)}>Cerrar</Button>
                {canVoid && detail.status === 'completed' ? (
                  <Button variant="destructive" onClick={() => setVoidTarget(detail)}>
                    <Ban className="h-4 w-4" /> Anular venta
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
        title={`¿Anular la venta ${voidTarget?.invoiceNumber ?? ''}?`}
        description="Se restaurará el inventario descontado, se revertirá el saldo de crédito y se generará un egreso de caja si la venta fue en efectivo. La acción queda auditada como crítica."
        confirmLabel="Anular venta"
        destructive
        onConfirm={() => {
          if (voidTarget) handleVoid(voidTarget);
          setVoidTarget(null);
        }}
      />
    </div>
  );
}
