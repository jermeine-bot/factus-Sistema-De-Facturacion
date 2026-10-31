import { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Package,
  Trophy,
} from 'lucide-react';
import type { Sale } from '@/types';
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
  round2,
} from '@/utils/format';
import { cn } from '@/lib/utils';

type RangeOption = '7' | '14' | '30' | '90';

function dayKey(date: Date): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export default function ParetoPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const products = useCatalogStore((state) => state.products);
  const settings = useSettingsStore((state) => state.settings);
  const [range, setRange] = useState<RangeOption>('30');

  const rate = settings.exchangeRate;
  const days = Number(range);

  const report = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const inRange = (sale: Sale): boolean =>
      sale.status === 'completed' && new Date(sale.createdAt) >= start;

    const current = sales.filter(inRange);

    const map = new Map<string, { name: string; units: number; revenue: number }>();
    for (const sale of current) {
      for (const item of sale.items) {
        const entry = map.get(item.productId) ?? { name: item.name, units: 0, revenue: 0 };
        entry.units = round2(entry.units + item.quantity);
        entry.revenue = round2(entry.revenue + item.total);
        map.set(item.productId, entry);
      }
    }

    const totalRevenue = round2(Array.from(map.values()).reduce((acc, entry) => acc + entry.revenue, 0));

    const sorted = Array.from(map.entries())
      .map(([id, entry]) => {
        const product = products.find((candidate) => candidate.id === id);
        return {
          id,
          name: entry.name,
          category: product?.category ?? 'Otros',
          units: entry.units,
          revenue: entry.revenue,
          share: totalRevenue > 0 ? round2((entry.revenue / totalRevenue) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    let cumulative = 0;
    const rows = sorted.map((entry) => {
      cumulative = round2(cumulative + entry.share);
      const abcClass = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
      return { ...entry, cumulative, abcClass };
    });

    const classTotals = rows.reduce(
      (acc, row) => {
        const cls = row.abcClass as 'A' | 'B' | 'C';
        acc[cls].count += 1;
        acc[cls].revenue = round2(acc[cls].revenue + row.revenue);
        return acc;
      },
      {
        A: { count: 0, revenue: 0 },
        B: { count: 0, revenue: 0 },
        C: { count: 0, revenue: 0 },
      } as Record<'A' | 'B' | 'C', { count: number; revenue: number }>,
    );

    return { rows, totalRevenue, totalUnits: round2(rows.reduce((acc, row) => acc + row.units, 0)), classTotals, ticketCount: current.length };
  }, [sales, products, days]);

  const maxRevenue = report.rows.reduce((acc, row) => Math.max(acc, row.revenue), 0);

  const handleExport = (): void => {
    const rows = [
      ['Análisis Pareto de artículos', `Últimos ${days} días`, formatDate(new Date().toISOString())],
      [],
      ['Producto', 'Categoría', 'Unidades', 'Ingresos', 'Participación %', 'Acumulado %', 'Clase ABC'],
      ...report.rows.map((row) => [row.name, row.category, row.units, row.revenue, row.share, row.cumulative, row.abcClass]),
    ];
    downloadCsv(`pareto-factus-${range}d-${dayKey(new Date())}.csv`, rows);
    toast.success('Pareto exportado', `${report.rows.length} artículos en CSV.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reportes"
        title="Análisis Pareto de artículos"
        description="Identifica los productos que concentran la mayor proporción de los ingresos por ventas del período. La clasificación ABC se basa en ingresos, no en ganancias."
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(value) => setRange(value as RangeOption)}>
              <SelectTrigger className="h-9 w-[150px] text-[11px]">
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
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos del período" value={formatMoney(report.totalRevenue, rate)} hint={`${report.ticketCount} facturas completadas`} icon={<BarChart3 />} accent="blue" />
        <StatCard label="Unidades vendidas" value={formatNumber(report.totalUnits, 2)} hint="Base y presentaciones" icon={<Package />} accent="sky" />
        <StatCard label="Clase A" value={`${report.classTotals.A.count} artículos`} hint={`${formatMoneyStat(report.classTotals.A.revenue, rate)} · hasta 80%`} icon={<Trophy />} accent="amber" />
        <StatCard label="Clase C" value={`${report.classTotals.C.count} artículos`} hint="Cola de baja rotación" icon={<Package />} accent="rose" />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-2">
          <h2 className="mb-3 font-display text-sm font-semibold">Participación y acumulado</h2>
          <div className="space-y-1.5">
            {report.rows.slice(0, 15).map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{row.name}</p>
                    <span className="num text-[10px] text-muted-foreground">{formatMoney(row.revenue, rate)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        row.abcClass === 'A' ? 'bg-primary' : row.abcClass === 'B' ? 'bg-info' : 'bg-muted-foreground/40',
                      )}
                      style={{ width: `${Math.max(2, (row.revenue / Math.max(maxRevenue, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <Badge
                  variant={row.abcClass === 'A' ? 'default' : row.abcClass === 'B' ? 'info' : 'secondary'}
                  className="w-8 justify-center"
                >
                  {row.abcClass}
                </Badge>
              </div>
            ))}
            {report.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Sin ventas en el período seleccionado.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-display text-sm font-semibold">Clasificación ABC</h2>
          <div className="space-y-3">
            {(['A', 'B', 'C'] as const).map((cls) => {
              const tone = cls === 'A' ? 'text-primary' : cls === 'B' ? 'text-info' : 'text-muted-foreground';
              const hint =
                cls === 'A' ? 'Hasta el 80% acumulado' : cls === 'B' ? 'Del 80% al 95%' : 'Resto de la cola';
              return (
                <div key={cls} className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className={cn('font-display text-lg font-bold', tone)}>Clase {cls}</span>
                    <Badge variant={cls === 'A' ? 'default' : cls === 'B' ? 'info' : 'secondary'}>
                      {report.classTotals[cls].count}
                    </Badge>
                  </div>
                  <p className="mt-1 num text-xs font-semibold">{formatMoney(report.classTotals[cls].revenue, rate)}</p>
                  <p className="text-[10px] text-muted-foreground">{hint}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Criterio: ingresos por ventas del período seleccionado, ordenados de mayor a menor, con porcentaje acumulado. No se usan costos ni márgenes.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Detalle por artículo</h2>
          <p className="text-[10px] text-muted-foreground">{report.rows.length} artículos con ventas en el período</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Artículo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Participación</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
              <TableHead className="text-center">Clase</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="num text-xs text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="text-xs font-medium">{row.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.category}</TableCell>
                <TableCell className="num text-right text-xs">{formatNumber(row.units, 2)}</TableCell>
                <TableCell className="num text-right text-xs font-semibold">{formatMoney(row.revenue, rate)}</TableCell>
                <TableCell className="num text-right text-xs">{formatNumber(row.share, 2)}%</TableCell>
                <TableCell className="num text-right text-xs">{formatNumber(row.cumulative, 2)}%</TableCell>
                <TableCell className="text-center">
                  <Badge variant={row.abcClass === 'A' ? 'default' : row.abcClass === 'B' ? 'info' : 'secondary'}>
                    {row.abcClass}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                  Sin datos para el período seleccionado.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
