import { useMemo, useState } from 'react';
import {
  ClipboardList,
  CreditCard,
  FileText,
  UserRound,
} from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney, formatMoneyStat, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function AccountStatementPage(): React.JSX.Element {
  const customers = useCatalogStore((state) => state.customers);
  const sales = useSalesStore((state) => state.sales);
  const settings = useSettingsStore((state) => state.settings);
  const rate = settings.exchangeRate;

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(customers[0]?.id ?? null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) =>
      term.length === 0 ||
      customer.name.toLowerCase().includes(term) ||
      customer.businessName.toLowerCase().includes(term) ||
      customer.phone.includes(term),
    );
  }, [customers, search]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  const customerSales = useMemo(() => {
    if (!selectedId) return [];
    return sales
      .filter((sale) => sale.customerId === selectedId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, selectedId]);

  const totalCredit = useMemo(
    () =>
      customerSales.reduce(
        (acc, sale) => acc + sale.payments.filter((payment) => payment.method === 'credit').reduce((sum, payment) => sum + payment.amount, 0),
        0,
      ),
    [customerSales],
  );

  const stats = useMemo(() => {
    const active = customers.filter((customer) => customer.isActive);
    const totalBalance = active.reduce((acc, customer) => acc + customer.balance, 0);
    const totalLimit = active.reduce((acc, customer) => acc + customer.creditLimit, 0);
    return { active: active.length, totalBalance, totalLimit };
  }, [customers]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Ventas" title="Estado de cuenta de clientes" description="Consulta facturas, créditos, abonos y saldos pendientes por cliente." icon={<ClipboardList className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes activos" value={String(stats.active)} hint="Con ficha de crédito" icon={<UserRound />} accent="blue" />
        <StatCard label="Saldo por cobrar" value={formatMoneyStat(stats.totalBalance, rate)} hint="Cartera total" icon={<CreditCard />} accent="amber" />
        <StatCard label="Crédito otorgado" value={formatMoneyStat(stats.totalLimit, rate)} hint="Límites aprobados" icon={<CreditCard />} accent="sky" />
        <StatCard label="Ventas del cliente" value={String(customerSales.length)} hint={selected ? selected.name : 'Selecciona un cliente'} icon={<FileText />} accent="emerald" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente…" />
          </div>
          <div className="max-h-[420px] overflow-y-auto p-1.5">
            {filtered.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelectedId(customer.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  selectedId === customer.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{customer.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{customer.businessName || customer.phone}</p>
                </div>
                <span className="num shrink-0 text-[10px] font-semibold">{formatMoney(customer.balance, rate)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {selected ? (
            <>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold">{selected.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selected.businessName || 'Persona natural'} · {selected.phone || 'Sin teléfono'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo pendiente</p>
                    <p className="num font-display text-lg font-bold text-warning">{formatMoney(selected.balance, rate)}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Límite</p>
                    <p className="num text-sm font-semibold">{formatMoney(selected.creditLimit, rate)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Disponible</p>
                    <p className="num text-sm font-semibold">{formatMoney(Math.max(0, selected.creditLimit - selected.balance), rate)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Crédito facturado</p>
                    <p className="num text-sm font-semibold">{formatMoney(totalCredit, rate)}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Facturas del cliente</h2></div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerSales.map((sale) => {
                      const credit = sale.payments.filter((payment) => payment.method === 'credit').reduce((sum, payment) => sum + payment.amount, 0);
                      return (
                        <TableRow key={sale.id}>
                          <TableCell className="text-xs font-semibold">{sale.invoiceNumber}</TableCell>
                          <TableCell className="text-xs">{formatDate(sale.createdAt)}</TableCell>
                          <TableCell className="num text-right text-xs">{formatMoney(sale.totals.total, rate)}</TableCell>
                          <TableCell className="num text-right text-xs">{credit > 0 ? formatMoney(credit, rate) : '—'}</TableCell>
                          <TableCell><Badge variant={sale.status === 'void' ? 'danger' : 'success'}>{sale.status === 'void' ? 'Anulada' : 'Completada'}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                    {customerSales.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">Sin facturas para este cliente.</TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Selecciona un cliente para ver su estado de cuenta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
