import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Package,
  ReceiptText,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { PaymentMethod } from '@/types';
import { useSalesStore } from '@/store/useSalesStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { useAuditStore } from '@/store/useAuditStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePOSStore } from '@/store/usePOSStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatDate,
  formatMoney,
  formatMoneyStat,
  formatNumber,
  formatPercent,
  formatTime,
  initials,
  timeAgo,
} from '@/utils/format';
import { stockStatus } from '@/utils/format';
import { cn } from '@/lib/utils';

const dayKey = (date: Date): string => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const paymentMeta: Record<PaymentMethod, { label: string; color: string; icon: typeof Banknote }> = {
  cash: { label: 'Efectivo', color: '#2563eb', icon: Banknote },
  card: { label: 'Tarjeta', color: '#0ea5e9', icon: CreditCard },
  transfer: { label: 'Transferencia', color: '#10b981', icon: Landmark },
  credit: { label: 'Crédito', color: '#f59e0b', icon: Users },
};

export default function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const sales = useSalesStore((state) => state.sales);
  const proformas = useSalesStore((state) => state.proformas);
  const products = useCatalogStore((state) => state.products);
  const customers = useCatalogStore((state) => state.customers);
  const logs = useAuditStore((state) => state.logs);
  const settings = useSettingsStore((state) => state.settings);
  const user = useSettingsStore((state) => state.currentUser);
  const session = useCashStore((state) => state.current);
  const clearPos = usePOSStore((state) => state.clear);
  const [range, setRange] = useState<7 | 14>(7);

  const rate = settings.exchangeRate;
  const completed = useMemo(() => sales.filter((sale) => sale.status === 'completed'), [sales]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return completed.filter((sale) => new Date(sale.createdAt) >= start);
  }, [completed]);

  const yesterday = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return completed.filter((sale) => {
      const date = new Date(sale.createdAt);
      return date >= start && date < end;
    });
  }, [completed]);

  const todayTotal = today.reduce((acc, sale) => acc + sale.totals.total, 0);
  const yesterdayTotal = yesterday.reduce((acc, sale) => acc + sale.totals.total, 0);
  const todayTrend = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;
  const todayTicket = today.length > 0 ? todayTotal / today.length : 0;
  const creditsToday = today.reduce(
    (acc, sale) =>
      acc + sale.payments.filter((payment) => payment.method === 'credit').reduce((sum, p) => sum + p.amount, 0),
    0,
  );
  const expectedCash = session ? sessionExpected(session) : 0;
  const openProformas = proformas.filter((proforma) => proforma.status === 'open');
  const creditExposure = customers.reduce((acc, customer) => acc + customer.balance, 0);
  const creditLimit = customers.reduce((acc, customer) => acc + customer.creditLimit, 0);

  const chartData = useMemo(() => {
    const days: Array<{ key: string; label: string; date: Date; total: number; count: number }> = [];
    for (let index = range - 1; index >= 0; index--) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      days.push({
        key: dayKey(date),
        label: new Intl.DateTimeFormat('es-NI', { weekday: 'short' }).format(date).replace('.', ''),
        date,
        total: 0,
        count: 0,
      });
    }
    const map = new Map(days.map((day) => [day.key, day]));
    for (const sale of completed) {
      const bucket = map.get(dayKey(new Date(sale.createdAt)));
      if (bucket) {
        bucket.total += sale.totals.total;
        bucket.count += 1;
      }
    }
    return days;
  }, [completed, range]);

  const chartMax = Math.max(...chartData.map((day) => day.total), 1);
  const chartTotal = chartData.reduce((acc, day) => acc + day.total, 0);
  const bestDay = chartData.reduce((best, day) => (day.total > best.total ? day : best), chartData[0]);

  const paymentMix = useMemo(() => {
    const totals: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 };
    const since = new Date();
    since.setDate(since.getDate() - 14);
    for (const sale of completed) {
      if (new Date(sale.createdAt) < since) continue;
      for (const payment of sale.payments) {
        totals[payment.method] += payment.amount;
      }
    }
    const sum = Object.values(totals).reduce((acc, value) => acc + value, 0);
    return (Object.keys(totals) as PaymentMethod[]).map((method) => ({
      method,
      amount: totals[method],
      percent: sum > 0 ? (totals[method] / sum) * 100 : 0,
      ...paymentMeta[method],
    }));
  }, [completed]);

  const topProducts = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const map = new Map<string, { name: string; revenue: number; units: number; accent: string }>();
    for (const sale of completed) {
      if (new Date(sale.createdAt) < since) continue;
      for (const item of sale.items) {
        const product = products.find((entry) => entry.id === item.productId);
        const current = map.get(item.productId) ?? {
          name: item.name,
          revenue: 0,
          units: 0,
          accent: product?.accent ?? '#3b82f6',
        };
        current.revenue += item.total;
        current.units += item.quantity;
        map.set(item.productId, current);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [completed, products]);

  const lowStock = useMemo(
    () =>
      products
        .filter(
          (product) =>
            product.isActive &&
            product.type !== 'floating' &&
            product.type !== 'integrated' &&
            stockStatus(product.stock, product.minStock) !== 'ok',
        )
        .sort((a, b) => a.stock / Math.max(a.minStock, 1) - b.stock / Math.max(b.minStock, 1))
        .slice(0, 5),
    [products],
  );

  const recentLogs = logs.slice(0, 5);
  const greeting =
    new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';
  const donutGradient = useMemo(() => {
    let cursor = 0;
    const segments = paymentMix.map((entry) => {
      const start = cursor;
      cursor += entry.percent;
      return `${entry.color} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }, [paymentMix]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatDate(new Date().toISOString())}
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        description="Un resumen claro de tus ingresos, efectivo disponible, crédito e inventario para decidir qué atender hoy."
        className="rounded-2xl border border-primary/10 bg-gradient-to-r from-card via-card to-primary/[0.06] p-5 shadow-sm sm:p-6"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/reportes')}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Ver reportes
            </Button>
            <Button
              size="sm"
              onClick={() => {
                clearPos();
                navigate('/pos');
              }}
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Nueva venta
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ventas de hoy"
          value={formatMoney(todayTotal, rate)}
          trend={todayTrend}
          hint={`vs. ayer ${formatMoney(yesterdayTotal, rate)}`}
          icon={<CircleDollarSign />}
          accent="blue"
          footer={
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{today.length} facturas emitidas</span>
              <span className="flex items-center gap-1 text-primary">
                <TrendingUp className="h-3 w-3" /> ticket {formatMoney(todayTicket, rate)}
              </span>
            </div>
          }
        />
        <StatCard
          label="Efectivo esperado"
          value={formatMoney(expectedCash, rate)}
          hint={session ? `Turno de ${session.openedBy}` : 'Sin caja abierta'}
          icon={<Wallet />}
          accent="emerald"
          footer={
            <button
              type="button"
              onClick={() => navigate('/caja')}
              className="flex w-full items-center justify-between text-[10px] text-success"
            >
              {session ? 'Ir al arqueo de caja' : 'Abrir una caja'}
              <ArrowRight className="h-3 w-3" />
            </button>
          }
        />
        <StatCard
          label="Crédito otorgado hoy"
          value={formatMoney(creditsToday, rate)}
          hint={`${formatPercent(creditLimit > 0 ? (creditExposure / creditLimit) * 100 : 0)} de la cartera utilizada`}
          icon={<Users />}
          accent="amber"
          footer={
            <div className="h-1 overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-warning to-warning"
                style={{ width: `${Math.min(100, creditLimit > 0 ? (creditExposure / creditLimit) * 100 : 0)}%` }}
              />
            </div>
          }
        />
        <StatCard
          label="Proformas abiertas"
          value={String(openProformas.length).padStart(2, '0')}
          hint={`${formatMoney(openProformas.reduce((acc, p) => acc + p.totals.total, 0), rate)} en cotizaciones`}
          icon={<ReceiptText />}
          accent="blue"
          footer={
            <button
              type="button"
              onClick={() => navigate('/proformas')}
              className="flex w-full items-center justify-between text-[10px] text-primary"
            >
              Convertir a venta
              <ArrowUpRight className="h-3 w-3" />
            </button>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold">Rendimiento de ventas</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="num font-display text-2xl font-bold">{formatMoney(chartTotal, rate)}</p>
                <Badge variant={todayTrend >= 0 ? 'success' : 'danger'}>
                  {todayTrend >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(todayTrend))} hoy
                </Badge>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Últimos {range} días · mejor día: {bestDay ? formatDate(bestDay.date.toISOString()) : '—'}
              </p>
            </div>
            <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
              {([7, 14] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    range === value ? 'bg-muted/40 text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value}d
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-5 h-[220px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[180px] flex-col justify-between">
              {[0, 1, 2, 3].map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <span className="num w-11 shrink-0 text-right text-[8px] text-muted-foreground/50">
                    {line === 0 ? '—' : `${Math.round((chartMax * (3 - line)) / 3 / 1000)}k`}
                  </span>
                  <div className="h-px flex-1 bg-muted/40" />
                </div>
              ))}
            </div>
            <div className="absolute inset-y-0 left-[52px] right-0 flex items-end gap-1.5 pb-5">
              {chartData.map((day) => {
                const height = day.total > 0 ? Math.max(6, (day.total / chartMax) * 100) : 2;
                return (
                  <div key={day.key} className="group relative flex h-full flex-1 flex-col justify-end">
                    <div className="relative flex flex-1 items-end">
                      <div
                        className={cn(
                          'relative w-full rounded-t-[4px] border-t transition-all duration-300',
                          day.total > 0
                            ? 'border-primary/30 bg-gradient-to-t from-primary/70 via-primary/50 to-primary/60 group-hover:from-primary/90 group-hover:to-primary/80'
                            : 'bg-muted/40',
                        )}
                        style={{ height: `${height}%` }}
                      >
                        <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 text-[9px] shadow-xl group-hover:block">
                          {formatMoney(day.total, rate)} · {day.count} ventas
                        </span>
                      </div>
                    </div>
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] uppercase text-muted-foreground/60">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Datos en vivo de {completed.length} ventas
            </span>
            <span>{formatMoneyStat(chartTotal / Math.max(range, 1), rate)} promedio diario</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold">Mix de pagos</p>
              <Badge variant="secondary">14 días</Badge>
            </div>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative h-[112px] w-[112px] shrink-0">
                <div className="h-full w-full rounded-full" style={{ background: donutGradient }} />
                <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-card">
                  <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Cobrado</p>
                  <p className="num text-sm font-bold">
                    {formatNumber(paymentMix.reduce((acc, entry) => acc + entry.amount, 0) / 1000, 0)}k
                  </p>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {paymentMix.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <div key={entry.method} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-[10px] text-muted-foreground">{entry.label}</span>
                      <span className="num text-[10px] font-semibold">{formatPercent(entry.percent, 0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Cartera crédito</p>
                <p className="num mt-0.5 text-xs font-semibold text-warning">{formatMoney(creditExposure, rate)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Límite total</p>
                <p className="num mt-0.5 text-xs font-semibold">{formatMoney(creditLimit, rate)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold">Acciones rápidas</p>
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Nueva venta', icon: ShoppingCart, path: '/pos', tone: 'text-primary bg-primary/10 border-primary/15' },
                { label: 'Arqueo de caja', icon: Wallet, path: '/caja', tone: 'text-success bg-success/10 border-success/15' },
                { label: 'Registrar compra', icon: Package, path: '/compras', tone: 'text-info bg-info/10 border-info/15' },
                { label: 'Nuevo gasto', icon: ReceiptText, path: '/gastos', tone: 'text-warning bg-warning/10 border-warning/15' },
              ].map((action) => (
                <button
                  key={action.path}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-transform hover:-translate-y-0.5',
                    action.tone,
                  )}
                >
                  <action.icon className="h-4 w-4" />
                  <span className="text-[10px] font-semibold text-foreground/90">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card shadow-sm xl:col-span-1">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <p className="font-display text-sm font-semibold">Top productos</p>
            <Badge variant="secondary">30 días</Badge>
          </div>
          <div className="divide-y divide-border">
            {topProducts.map((product, index) => (
              <div key={`${product.name}-${index}`} className="flex items-center gap-3 px-4 py-3">
                <span className="num w-4 text-[10px] font-bold text-muted-foreground/60">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
                  style={{
                    borderColor: `${product.accent}33`,
                    backgroundColor: `${product.accent}12`,
                    color: product.accent,
                  }}
                >
                  {product.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{product.name}</p>
                  <p className="text-[9px] text-muted-foreground">{product.units} unidades vendidas</p>
                </div>
                <p className="num text-[11px] font-semibold">{formatMoney(product.revenue, rate)}</p>
              </div>
            ))}
            {topProducts.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">Sin ventas registradas.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" /> Stock crítico
            </p>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="text-[10px] text-primary hover:text-primary"
            >
              Ver todo
            </button>
          </div>
          <div className="divide-y divide-border">
            {lowStock.map((product) => {
              const ratio = Math.min(100, (product.stock / Math.max(product.minStock, 1)) * 100);
              return (
                <div key={product.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-medium">{product.name}</p>
                    <Badge variant={product.stock <= 0 ? 'danger' : 'warning'}>
                      {formatNumber(product.stock, 2)} {product.unit}
                    </Badge>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        product.stock <= 0 ? 'bg-destructive' : ratio < 50 ? 'bg-destructive' : 'bg-warning',
                      )}
                      style={{ width: `${Math.max(4, ratio)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    Mínimo requerido: {product.minStock} {product.unit}
                  </p>
                </div>
              );
            })}
            {lowStock.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11px] text-success">Inventario saludable.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <Activity className="h-3.5 w-3.5 text-info" /> Actividad reciente
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin?tab=auditoria')}
              className="text-[10px] text-primary hover:text-primary"
            >
              Auditoría
            </button>
          </div>
          <div className="space-y-0 divide-y divide-border">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex gap-2.5 px-4 py-3">
                <div
                  className={cn(
                    'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                    log.severity === 'critical'
                      ? 'bg-destructive'
                      : log.severity === 'warning'
                        ? 'bg-warning'
                        : 'bg-success',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[10px] leading-relaxed text-foreground/85">{log.description}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white"
                      style={{ backgroundColor: usersColor(log.userName) }}
                    >
                      {initials(log.userName)}
                    </span>
                    {log.userName} · {timeAgo(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3">
            <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={() => navigate('/admin?tab=auditoria')}>
              Ver bitácora completa <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/10 bg-gradient-to-r from-primary/[0.07] via-transparent to-info/[0.05] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold">Estado del turno de caja</p>
            <p className="text-[10px] text-muted-foreground">
              {session
                ? `Sesión abierta ${formatTime(session.openedAt)} por ${session.openedBy}. Efectivo esperado ${formatMoney(expectedCash, rate)}.`
                : 'No hay caja abierta actualmente. Abre una sesión para operar en efectivo.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={session ? 'success' : 'warning'}>
            <span className={cn('h-1.5 w-1.5 rounded-full', session ? 'bg-success' : 'bg-warning')} />
            {session ? 'Operación en curso' : 'Caja cerrada'}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => navigate('/caja')}>
            Gestionar caja
          </Button>
        </div>
      </div>
    </div>
  );
}

const avatarPalette = ['#6366f1', '#f59e0b', '#10b981', '#06b6d4', '#e879f9'];
function usersColor(name: string): string {
  const char = name.charCodeAt(0) || 0;
  return avatarPalette[char % avatarPalette.length];
}
