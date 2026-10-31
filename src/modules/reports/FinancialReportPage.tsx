import { useMemo } from 'react';
import { Wallet, TrendingDown, Truck, Banknote } from 'lucide-react';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney, formatDate } from '@/utils/format';

export default function FinancialReportPage(): React.JSX.Element {
  const cash = useCashStore((state) => state);
  const purchases = usePurchaseStore((state) => state.purchases);
  const expenses = usePurchaseStore((state) => state.expenses);
  const suppliers = useCatalogStore((state) => state.suppliers);
  const settings = useSettingsStore((state) => state.settings);
  const rate = settings.exchangeRate;

  const sessions = useMemo(() => (cash.current ? [cash.current, ...cash.history] : cash.history), [cash.current, cash.history]);

  const totalPurchases = useMemo(() => purchases.reduce((acc, purchase) => acc + purchase.total, 0), [purchases]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, expense) => acc + expense.amount, 0), [expenses]);
  const supplierDebt = useMemo(() => suppliers.reduce((acc, supplier) => acc + supplier.balance, 0), [suppliers]);
  const cashMovements = useMemo(() => sessions.reduce((acc, session) => acc + session.movements.length, 0), [sessions]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
    }
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reportes" title="Reportes financieros" description="Resumen de caja, gastos, compras y saldos con proveedores." icon={<Wallet className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sesiones de caja" value={String(sessions.length)} hint={`${cashMovements} movimientos`} icon={<Banknote />} accent="blue" />
        <StatCard label="Compras acumuladas" value={formatMoney(totalPurchases, rate)} hint={`${purchases.length} facturas`} icon={<Truck />} accent="sky" />
        <StatCard label="Gastos acumulados" value={formatMoney(totalExpenses, rate)} hint={`${expenses.length} registros`} icon={<TrendingDown />} accent="amber" />
        <StatCard label="Deuda con proveedores" value={formatMoney(supplierDebt, rate)} hint="Saldos pendientes" icon={<Wallet />} accent="rose" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Gastos por categoría</h2></div>
          <Table>
            <TableHeader><TableRow><TableHead>Categoría</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
            <TableBody>
              {expensesByCategory.map((row) => (
                <TableRow key={row.category}>
                  <TableCell className="text-xs font-medium">{row.category}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(row.amount, rate)}</TableCell>
                </TableRow>
              ))}
              {expensesByCategory.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="py-6 text-center text-xs text-muted-foreground">Sin gastos registrados.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Sesiones de caja</h2></div>
          <Table>
            <TableHeader><TableRow><TableHead>Apertura</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Contado</TableHead></TableRow></TableHeader>
            <TableBody>
              {sessions.slice(0, 12).map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="text-xs">{formatDate(session.openedAt)}</TableCell>
                  <TableCell><Badge variant={session.status === 'open' ? 'success' : 'secondary'}>{session.status === 'open' ? 'Abierta' : 'Cerrada'}</Badge></TableCell>
                  <TableCell className="num text-right text-xs">{formatMoney(session.status === 'open' ? sessionExpected(session) : (session.expectedCash ?? 0), rate)}</TableCell>
                  <TableCell className="num text-right text-xs">{session.countedCash != null ? formatMoney(session.countedCash, rate) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
