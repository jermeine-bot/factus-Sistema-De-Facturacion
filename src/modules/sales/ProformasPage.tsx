import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Printer,
  Search,
  ShoppingCart,
  TimerOff,
  UserRound,
} from 'lucide-react';
import type { Proforma } from '@/types';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePOSStore } from '@/store/usePOSStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { PaymentDialog } from '@/modules/pos/PaymentDialog';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/utils/format';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'open' | 'converted' | 'expired';

function isExpired(proforma: Proforma): boolean {
  return proforma.status === 'open' && new Date(proforma.validUntil).getTime() < Date.now();
}

export default function ProformasPage(): React.JSX.Element {
  const proformas = useSalesStore((state) => state.proformas);
  const settings = useSettingsStore((state) => state.settings);
  const loadProforma = usePOSStore((state) => state.loadProforma);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<Proforma | null>(null);

  const rate = settings.exchangeRate;

  const stats = useMemo(() => {
    const open = proformas.filter((proforma) => proforma.status === 'open');
    const converted = proformas.filter((proforma) => proforma.status === 'converted');
    const expired = proformas.filter(isExpired);
    const openValue = open.reduce((acc, proforma) => acc + proforma.totals.total, 0);
    const conversionRate = proformas.length > 0 ? (converted.length / proformas.length) * 100 : 0;
    return {
      openCount: open.length,
      convertedCount: converted.length,
      expiredCount: expired.length,
      openValue,
      conversionRate,
    };
  }, [proformas]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proformas
      .filter((proforma) => {
        if (term && !`${proforma.number} ${proforma.customerName} ${proforma.userName}`.toLowerCase().includes(term)) {
          return false;
        }
        if (statusFilter === 'expired') return isExpired(proforma);
        if (statusFilter === 'open') return proforma.status === 'open' && !isExpired(proforma);
        if (statusFilter === 'converted') return proforma.status === 'converted';
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [proformas, search, statusFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const detail = proformas.find((proforma) => proforma.id === detailId) ?? null;

  const handleLoadPOS = (proforma: Proforma): void => {
    loadProforma(proforma);
    toast.info(`${proforma.number} cargada en el POS`, 'Revisa el ticket y confirma el cobro.');
    navigate('/pos');
  };

  const statusBadge = (proforma: Proforma): React.JSX.Element => {
    if (proforma.status === 'converted') return <Badge variant="success"><CheckCircle2 /> Convertida</Badge>;
    if (isExpired(proforma)) return <Badge variant="danger"><TimerOff /> Vencida</Badge>;
    return <Badge variant="info"><Clock /> Abierta</Badge>;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comercial"
        title="Proformas y cotizaciones"
        description="Convierte cotizaciones en ventas con un solo clic, recupéralas en el POS o controla su vigencia."
        icon={<FileText className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => navigate('/pos')}>
            <ShoppingCart className="h-3.5 w-3.5" /> Ir al POS
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Proformas abiertas" value={String(stats.openCount)} hint="Listas para cotizar o cargar" icon={<Clock />} accent="sky" />
        <StatCard label="Valor cotizado" value={formatMoney(stats.openValue, rate)} hint="Proformas vigentes sin convertir" icon={<FileText />} accent="blue" />
        <StatCard label="Tasa de conversión" value={`${formatNumber(stats.conversionRate, 1)}%`} hint={`${stats.convertedCount} convertidas a factura`} icon={<CheckCircle2 />} accent="emerald" />
        <StatCard label="Vencidas" value={String(stats.expiredCount)} hint="Requieren renovación de vigencia" icon={<TimerOff />} accent="rose" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Buscar número, cliente o vendedor…"
            className="w-full lg:max-w-xs"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => { setStatusFilter(value as StatusFilter); setPage(1); }}
          >
            <SelectTrigger className="h-9 w-[150px] text-[11px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="open">Abiertas</SelectItem>
              <SelectItem value="converted">Convertidas</SelectItem>
              <SelectItem value="expired">Vencidas</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> {filtered.length} resultados
          </div>
        </div>

        {paginated.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="Sin proformas en este filtro"
            description="Genera una cotización desde el POS con el botón «Proforma» del ticket."
            action={<Button size="sm" onClick={() => navigate('/pos')}>Abrir punto de venta</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proforma</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((proforma) => (
                <TableRow key={proforma.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="num text-xs font-semibold">{proforma.number}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(proforma.createdAt)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium">{proforma.customerName}</p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <UserRound className="h-2.5 w-2.5" /> {proforma.userName}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{proforma.userName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs">
                      <CalendarClock className="h-3 w-3 text-muted-foreground" />
                      <span className={cn(isExpired(proforma) && 'text-destructive')}>
                        {formatDate(proforma.validUntil)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="num text-right text-xs">{proforma.items.length}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">
                    {formatMoney(proforma.totals.total, rate)}
                  </TableCell>
                  <TableCell>{statusBadge(proforma)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDetailId(proforma.id)} aria-label="Ver detalle">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {proforma.status === 'open' ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleLoadPOS(proforma)}
                            aria-label="Cargar en POS"
                            title="Cargar en POS"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => setConvertTarget(proforma)}
                            disabled={isExpired(proforma)}
                            title={isExpired(proforma) ? 'Proforma vencida' : 'Convertir a venta'}
                          >
                            <ArrowRightCircle className="h-3.5 w-3.5" /> Convertir
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filtered.length > pageSize ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>Página {safePage} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail ? (
            <>
              <div className="print-sheet space-y-3">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-info" /> {detail.number}
                  </DialogTitle>
                  <DialogDescription>
                    {detail.customerName} · Creada {formatDateTime(detail.createdAt)}
                  </DialogDescription>
                </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(detail)}
                <Badge variant="secondary">Vigente hasta {formatDate(detail.validUntil)}</Badge>
                <Badge variant="outline">{detail.items.length} líneas</Badge>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item) => (
                      <TableRow key={item.lineId}>
                        <TableCell>
                          <p className="text-xs font-medium">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.unitLabel}</p>
                        </TableCell>
                        <TableCell className="num text-right text-xs">{formatNumber(item.quantity, 2)}</TableCell>
                        <TableCell className="num text-right text-xs">{formatMoney(item.unitPrice, rate)}</TableCell>
                        <TableCell className="num text-right text-xs font-semibold">
                          {formatMoney(item.quantity * item.unitPrice * (1 - item.discount / 100), rate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>Subtotal</span><span className="num">{formatMoney(detail.totals.subtotal, rate)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>IVA incluido</span><span className="num">{formatMoney(detail.totals.tax, rate)}</span>
                </div>
                {detail.totals.discount > 0 ? (
                  <div className="flex justify-between py-0.5 text-destructive">
                    <span>Descuento</span><span className="num">-{formatMoney(detail.totals.discount, rate)}</span>
                  </div>
                ) : null}
                <Separator className="my-2" />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span><span className="num">{formatMoney(detail.totals.total, rate)}</span>
                </div>
              </div>

              {detail.notes ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  {detail.notes}
                </p>
              ) : null}
              </div>

              <DialogFooter className="print-hidden">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                {detail.status === 'open' && !isExpired(detail) ? (
                  <Button onClick={() => { setConvertTarget(detail); setDetailId(null); }}>
                    <ArrowRightCircle className="h-4 w-4" /> Convertir a venta
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={Boolean(convertTarget)}
        onOpenChange={(open) => { if (!open) setConvertTarget(null); }}
        items={convertTarget?.items ?? []}
        customerId={convertTarget?.customerId ?? null}
        currency="NIO"
        exchangeRate={rate}
        notes={convertTarget?.notes ?? ''}
        proformaId={convertTarget?.id ?? null}
        onSuccess={(sale) => {
          toast.success('Proforma convertida', `${convertTarget?.number ?? ''} → ${sale.invoiceNumber}`);
          setConvertTarget(null);
        }}
      />
    </div>
  );
}
