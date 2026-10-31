import { useMemo, useState } from 'react';
import { BarChart3, Search } from 'lucide-react';
import { useSalesStore } from '@/store/useSalesStore';

import { useSettingsStore } from '@/store/useSettingsStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, formatMoneyStat } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function ParetoCustomersPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const sale of sales) {
      if (sale.status === 'void') continue;
      const key = sale.customerId ?? '__final__';
      const name = sale.customerName || 'Consumidor Final';
      const current = map.get(key) ?? { name, total: 0 };
      current.total += sale.totals.total;
      map.set(key, current);
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const grand = sorted.reduce((acc, r) => acc + r.total, 0) || 1;
    let cumulative = 0;
    return sorted.map((r) => {
      const pct = (r.total / grand) * 100;
      cumulative += pct;
      const cls = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
      return { ...r, pct, cumulative, cls };
    });
  }, [sales]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => (term ? r.name.toLowerCase().includes(term) : true));
  }, [rows, search]);

  const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración"
        title="Pareto de clientes"
        description="Análisis de clientes por volumen de ventas: participación, acumulado y clasificación ABC."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Clientes" value={String(rows.length)} hint="Con ventas" icon={<BarChart3 />} accent="blue" />
        <StatCard label="Total vendido" value={formatMoneyStat(grandTotal, rate)} hint="Ventas completadas" icon={<BarChart3 />} accent="sky" />
        <StatCard label="Clase A" value={String(rows.filter((r) => r.cls === 'A').length)} hint="80% del valor" icon={<BarChart3 />} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border p-3.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" className="h-8 flex-1 bg-transparent text-xs outline-none" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<BarChart3 />} title="Sin datos" description="No hay ventas registradas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total comprado</TableHead>
                <TableHead className="text-right">Participación</TableHead>
                <TableHead className="text-right">% Acumulado</TableHead>
                <TableHead>Clase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs font-medium">{r.name}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(r.total, rate)}</TableCell>
                  <TableCell className="num text-right text-xs">{r.pct.toFixed(1)}%</TableCell>
                  <TableCell className="num text-right text-xs">{r.cumulative.toFixed(1)}%</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        r.cls === 'A' ? 'bg-success/10 text-success' : r.cls === 'B' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {r.cls}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}