import { useMemo } from 'react';
import { Calculator, Wallet } from 'lucide-react';
import { useCashStore } from '@/store/useCashStore';
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
import { formatMoney, formatMoneyStat, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function CashClosuresPage(): React.JSX.Element {
  const history = useCashStore((state) => state.history);
  const current = useCashStore((state) => state.current);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const closed = useMemo(() => history.filter((s) => s.status === 'closed'), [history]);

  const totals = useMemo(() => {
    const expected = closed.reduce((acc, s) => acc + (s.expectedCash ?? 0), 0);
    const counted = closed.reduce((acc, s) => acc + (s.countedCash ?? 0), 0);
    const diff = closed.reduce((acc, s) => acc + (s.difference ?? 0), 0);
    return { expected, counted, diff };
  }, [closed]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ventas"
        title="Reporte de cierres de caja"
        description="Historial de sesiones cerradas con saldo inicial, ingresos, egresos, efectivo esperado, contado y diferencias."
        icon={<Calculator className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Cierres" value={String(closed.length)} hint="Sesiones cerradas" icon={<Calculator />} accent="blue" />
        <StatCard label="Esperado total" value={formatMoneyStat(totals.expected, rate)} hint="Suma esperado" icon={<Wallet />} accent="sky" />
        <StatCard label="Contado total" value={formatMoneyStat(totals.counted, rate)} hint="Suma contado" icon={<Wallet />} accent="amber" />
        <StatCard
          label="Diferencia total"
          value={formatMoneyStat(totals.diff, rate)}
          hint={totals.diff === 0 ? 'Sin diferencias' : totals.diff > 0 ? 'Sobrante' : 'Faltante'}
          icon={<Wallet />}
          accent={totals.diff === 0 ? 'emerald' : totals.diff > 0 ? 'sky' : 'rose'}
        />
      </div>

      {current ? (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-[11px] text-warning">
          Hay una sesión de caja abierta ({current.openedBy}). No se incluye en el reporte hasta su cierre.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {closed.length === 0 ? (
          <EmptyState icon={<Calculator />} title="Sin cierres" description="No hay sesiones de caja cerradas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apertura</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closed.map((s) => {
                const ingresos = s.movements.filter((m) => m.amount > 0).reduce((a, m) => a + m.amount, 0);
                const egresos = s.movements.filter((m) => m.amount < 0).reduce((a, m) => a + m.amount, 0);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-[11px] text-muted-foreground">{formatDate(s.openedAt)}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{s.closedAt ? formatDate(s.closedAt) : '—'}</TableCell>
                    <TableCell className="text-xs font-medium">{s.closedBy ?? s.openedBy}</TableCell>
                    <TableCell className="num text-right text-xs">{formatMoney(s.initialAmount, rate)}</TableCell>
                    <TableCell className="num text-right text-xs text-success">{formatMoney(ingresos, rate)}</TableCell>
                    <TableCell className="num text-right text-xs text-destructive">{formatMoney(egresos, rate)}</TableCell>
                    <TableCell className="num text-right text-xs">{formatMoney(s.expectedCash ?? 0, rate)}</TableCell>
                    <TableCell className="num text-right text-xs">{formatMoney(s.countedCash ?? 0, rate)}</TableCell>
                    <TableCell className={cn('num text-right text-xs font-semibold', (s.difference ?? 0) === 0 ? 'text-success' : (s.difference ?? 0) > 0 ? 'text-sky-600' : 'text-destructive')}>
                      {formatMoney(s.difference ?? 0, rate)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}