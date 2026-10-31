import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Banknote,
  CreditCard,
  Download,
  Landmark,
  Percent,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Trophy,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import type { PaymentMethod, Sale } from '@/types';
import { useSalesStore } from '@/store/useSalesStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
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
  downloadCsv,
  formatDate,
  formatMoney,
  formatMoneyStat,
  formatNumber,
  formatPercent,
  round2,
} from '@/utils/format';
import { cn } from '@/lib/utils';

type RangeOption = '7' | '14' | '30' | '90';

const methodMeta: Record<PaymentMethod, { label: string; color: string; icon: typeof Banknote }> = {
  cash: { label: 'Efectivo', color: '#2563eb', icon: Banknote },
  card: { label: 'Tarjeta', color: '#0ea5e9', icon: CreditCard },
  transfer: { label: 'Transferencia', color: '#10b981', icon: Landmark },
  credit: { label: 'Crédito', color: '#f59e0b', icon: UserRoundCheck },
};

const dayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shortDay = (date: Date): string =>
  new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(date);

export default function ReportsPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const products = useCatalogStore((state) => state.products);
  const customers = useCatalogStore((state) => state.customers);
  const settings = useSettingsStore((state) => state.settings);

  const [range, setRange] = useState<RangeOption>('14');
  const rate = settings.exchangeRate;
  const days = Number(range);

  const report = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - days);
    const previousEnd = new Date(start);

    const inRange = (sale: Sale, from: Date, to: Date): boolean => {
      const created = new Date(sale.createdAt);
      return sale.status === 'completed' && created >= from && created < to;
    };

    const current = sales.filter((sale) => inRange(sale, start, new Date(now.getTime() + 1000)));
    const previous = sales.filter((sale) => inRange(sale, previousStart, previousEnd));

    const revenue = round2(current.reduce((acc, sale) => acc + sale.totals.total, 0));
    const previousRevenue = round2(previous.reduce((acc, sale) => acc + sale.totals.total, 0));
    const cost = round2(current.reduce((acc, sale) => acc + sale.totals.cost, 0));
    const tax = round2(current.reduce((acc, sale) => acc + sale.totals.tax, 0));
    const discounts = round2(current.reduce((acc, sale) => acc + sale.totals.discount, 0));
    const margin = revenue > 0 ? round2(((revenue - tax - cost) / revenue) * 100) : 0;
    const ticket = current.length > 0 ? round2(revenue / current.length) : 0;

    // Daily series
    const buckets = new Map<string, { label: string; value: number; tickets: number }>();
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - index);
      date.setHours(0, 0, 0, 0);
      buckets.set(dayKey(date), { label: shortDay(date), value: 0, tickets: 0 });
    }
    for (const sale of current) {
      const key = dayKey(new Date(sale.createdAt));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.value = round2(bucket.value + sale.totals.total);
        bucket.tickets += 1;
      }
    }
    const daily = Array.from(buckets.values());
    const maxDaily = daily.reduce((acc, bucket) => Math.max(acc, bucket.value), 0);

    // Payment mix
    const mixMap = new Map<PaymentMethod, number>();
    for (const sale of current) {
      for (const payment of sale.payments) {
        mixMap.set(payment.method, round2((mixMap.get(payment.method) ?? 0) + payment.amount));
      }
    }
    const mix = (Object.keys(methodMeta) as PaymentMethod[])
      .map((method) => ({ method, total: mixMap.get(method) ?? 0 }))
      .filter((entry) => entry.total > 0);

    // Top products
    const productMap = new Map<string, { name: string; units: number; revenue: number; cost: number }>();
    for (const sale of current) {
      for (const item of sale.items) {
        const key = item.productId;
        const entry = productMap.get(key) ?? { name: item.name, units: 0, revenue: 0, cost: 0 };
        const product = products.find((candidate) => candidate.id === item.productId);
        entry.units = round2(entry.units + item.quantity);
        entry.revenue = round2(entry.revenue + item.total);
        entry.cost = round2(entry.cost + (product ? product.cost * item.quantity * item.unitRatio : 0));
        productMap.set(key, entry);
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((entry) => ({
        ...entry,
        margin: entry.revenue > 0 ? round2(((entry.revenue - entry.cost) / entry.revenue) * 100) : 0,
      }));

    // Top customers
    const customerMap = new Map<string, { name: string; tickets: number; revenue: number }>();
    for (const sale of current) {
      const key = sale.customerId ?? 'final';
      const entry = customerMap.get(key) ?? { name: sale.customerName, tickets: 0, revenue: 0 };
      entry.tickets += 1;
      entry.revenue = round2(entry.revenue + sale.totals.total);
      customerMap.set(key, entry);
    }
    const topCustomers = Array.from(customerMap.entries())
      .map(([id, entry]) => ({
        ...entry,
        id,
        balance: customers.find((customer) => customer.id === id)?.balance ?? 0,
        creditLimit: customers.find((customer) => customer.id === id)?.creditLimit ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // Category performance
    const categoryMap = new Map<string, { revenue: number; cost: number }>();
    for (const sale of current) {
      for (const item of sale.items) {
        const product = products.find((candidate) => candidate.id === item.productId);
        const category = product?.category ?? 'Otros';
        const entry = categoryMap.get(category) ?? { revenue: 0, cost: 0 };
        entry.revenue = round2(entry.revenue + item.total);
        entry.cost = round2(entry.cost + (product ? product.cost * item.quantity * item.unitRatio : 0));
        categoryMap.set(category, entry);
      }
    }
    const categories = Array.from(categoryMap.entries())
      .map(([name, entry]) => ({
        name,
        ...entry,
        margin: entry.revenue > 0 ? round2(((entry.revenue - entry.cost) / entry.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const trend = previousRevenue > 0 ? round2(((revenue - previousRevenue) / previousRevenue) * 100) : 0;

    return {
      current,
      revenue,
      previousRevenue,
      cost,
      tax,
      discounts,
      margin,
      ticket,
      daily,
      maxDaily,
      mix,
      topProducts,
      topCustomers,
      categories,
      trend,
    };
  }, [sales, products, customers, days]);

  const mixTotal = report.mix.reduce((acc, entry) => acc + entry.total, 0);
  const gradient = useMemo(() => {
    if (mixTotal <= 0) return 'conic-gradient(#1e293b 0deg 360deg)';
    let cumulative = 0;
    const parts = report.mix.map((entry) => {
      const start = (cumulative / mixTotal) * 360;
      cumulative += entry.total;
      const end = (cumulative / mixTotal) * 360;
      return `${methodMeta[entry.method].color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }, [report.mix, mixTotal]);

  const handleExport = (): void => {
    const rows: Array<Array<string | number>> = [
      ['Reporte ejecutivo Factus', `Últimos ${days} días`, formatDate(new Date().toISOString())],
      [],
      ['Indicador', 'Valor'],
      ['Ingresos', report.revenue],
      ['Costo de ventas', report.cost],
      ['IVA incluido', report.tax],
      ['Descuentos', report.discounts],
      ['Margen bruto %', report.margin],
      ['Tickets', report.current.length],
      ['Ticket promedio', report.ticket],
      [],
      ['Fecha', 'Ventas', 'Tickets'],
      ...report.daily.map((bucket) => [bucket.label, bucket.value, bucket.tickets]),
      [],
      ['Producto', 'Unidades', 'Ingresos', 'Margen %'],
      ...report.topProducts.map((product) => [product.name, product.units, product.revenue, product.margin]),
      [],
      ['Cliente', 'Tickets', 'Ingresos', 'Saldo'],
      ...report.topCustomers.map((customer) => [customer.name, customer.tickets, customer.revenue, customer.balance]),
    ];
    downloadCsv(`reporte-factus-${range}d-${dayKey(new Date())}.csv`, rows);
    toast.success('Reporte exportado', `${range} días de operación en CSV.`);
  };

  const maxCategory = report.categories.reduce((acc, category) => Math.max(acc, category.revenue), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inteligencia de negocio"
        title="Reportes y analítica"
        description="Consulta ingresos, márgenes y medios de pago para el periodo seleccionado."
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <>
            <Select value={range} onValueChange={(value) => setRange(value as RangeOption)}>
              <SelectTrigger className="h-10 w-[170px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="14">Últimos 14 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos del periodo"
          value={formatMoneyStat(report.revenue, rate)}
          hint={`Periodo anterior: ${formatMoney(report.previousRevenue, rate)}`}
          trend={report.previousRevenue > 0 ? report.trend : undefined}
          icon={<TrendingUp />}
          accent="blue"
        />
        <StatCard
          label="Margen bruto"
          value={formatPercent(report.margin)}
          hint={`Costo de ventas ${formatMoney(report.cost, rate)}`}
          icon={<Percent />}
          accent="emerald"
        />
        <StatCard
          label="Tickets emitidos"
          value={formatNumber(report.current.length)}
          hint={`Ticket promedio ${formatMoney(report.ticket, rate)}`}
          icon={<ReceiptText />}
          accent="sky"
        />
        <StatCard
          label="Descuentos otorgados"
          value={formatMoneyStat(report.discounts, rate)}
          hint={`IVA incluido ${formatMoney(report.tax, rate)}`}
          icon={<ShoppingBag />}
          accent="amber"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold">Ventas por día</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Ingresos brutos con IVA incluido · últimos {days} días</p>
            </div>
            {report.previousRevenue > 0 ? (
              <Badge variant={report.trend >= 0 ? 'success' : 'danger'}>
                {report.trend >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                {formatPercent(Math.abs(report.trend))} vs. periodo anterior
              </Badge>
            ) : (
              <Badge variant="secondary">Sin historial previo</Badge>
            )}
          </div>

          <div className="mt-5 flex h-[220px] items-end gap-1.5">
            {report.daily.map((bucket, index) => {
              const height = report.maxDaily > 0 ? Math.max(2, (bucket.value / report.maxDaily) * 100) : 2;
              const showLabel = days <= 14 || index % Math.ceil(days / 10) === 0;
              return (
                <div key={`${bucket.label}-${index}`} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className={cn(
                      'relative w-full rounded-t-[3px] bg-gradient-to-t from-primary/70 to-info/80 transition-all duration-300 group-hover:from-primary group-hover:to-info',
                      bucket.value === 0 && 'from-white/[0.06] to-white/[0.03]',
                    )}
                    style={{ height: `${height}%` }}
                  >
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground shadow-xl group-hover:block">
                      <span className="num font-semibold">{formatMoney(bucket.value, rate)}</span>
                      <span className="ml-1 text-muted-foreground">· {bucket.tickets} tickets</span>
                    </div>
                  </div>
                  {showLabel ? (
                    <span className="mt-1.5 h-3 truncate text-center text-[9px] text-muted-foreground">{bucket.label}</span>
                  ) : (
                    <span className="mt-1.5 h-3" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-sm font-semibold">Medios de pago</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Distribución del efectivo cobrado</p>

          <div className="relative mx-auto mt-5 h-40 w-40">
            <div className="h-full w-full rounded-full" style={{ background: gradient }} />
            <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full border border-border bg-card text-center">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Cobrado</span>
              <span className="num mt-0.5 text-sm font-bold">{formatMoney(mixTotal, rate)}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {report.mix.length === 0 ? (
              <p className="text-center text-[11px] text-muted-foreground">Sin cobros en el periodo.</p>
            ) : (
              report.mix.map((entry) => {
                const meta = methodMeta[entry.method];
                const Icon = meta.icon;
                const share = mixTotal > 0 ? (entry.total / mixTotal) * 100 : 0;
                return (
                  <div key={entry.method} className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 text-muted-foreground">{meta.label}</span>
                    <span className="num font-semibold">{formatPercent(share)}</span>
                    <span className="num w-[86px] text-right text-[10px] text-muted-foreground">
                      {formatMoney(entry.total, rate)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Trophy className="h-4 w-4 text-warning" />
            <div>
              <h2 className="font-display text-sm font-semibold">Productos más vendidos</h2>
              <p className="text-[10px] text-muted-foreground">Ordenado por ingresos del periodo</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topProducts.map((product, index) => (
                <TableRow key={`${product.name}-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted/40 text-[9px] font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="max-w-[180px] truncate text-xs font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="num text-right text-xs">{formatNumber(product.units, 2)}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(product.revenue, rate)}</TableCell>
                  <TableCell className={cn('num text-right text-xs font-semibold', product.margin >= 30 ? 'text-success' : 'text-warning')}>
                    {formatPercent(product.margin)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {report.topProducts.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">Sin ventas en el periodo.</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-display text-sm font-semibold">Mejores clientes</h2>
              <p className="text-[10px] text-muted-foreground">Facturación y saldo de crédito actual</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topCustomers.map((customer, index) => (
                <TableRow key={`${customer.id}-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted/40 text-[9px] font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="max-w-[170px] truncate text-xs font-medium">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="num text-right text-xs">{customer.tickets}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(customer.revenue, rate)}</TableCell>
                  <TableCell className={cn('num text-right text-xs', customer.balance > 0 ? 'text-warning' : 'text-muted-foreground')}>
                    {formatMoney(customer.balance, rate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {report.topCustomers.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">Sin clientes facturados en el periodo.</p>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BarChart3 className="h-4 w-4 text-info" />
          <div>
            <h2 className="font-display text-sm font-semibold">Rentabilidad por categoría</h2>
            <p className="text-[10px] text-muted-foreground">Ingresos y margen bruto estimado por línea de producto</p>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {report.categories.map((category) => (
            <div key={category.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium">{category.name}</span>
                <div className="flex items-center gap-2">
                  <span className="num text-muted-foreground">{formatMoney(category.revenue, rate)}</span>
                  <Badge variant={category.margin >= 30 ? 'success' : category.margin >= 15 ? 'warning' : 'danger'}>
                    {formatPercent(category.margin)}
                  </Badge>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-info"
                  style={{ width: `${maxCategory > 0 ? Math.max(3, (category.revenue / maxCategory) * 100) : 3}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {report.categories.length === 0 ? (
          <p className="px-4 pb-6 text-center text-[11px] text-muted-foreground">Sin datos de categorías en el periodo.</p>
        ) : null}
      </div>
    </div>
  );
}
