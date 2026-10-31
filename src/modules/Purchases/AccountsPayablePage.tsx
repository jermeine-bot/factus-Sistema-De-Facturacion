import { useMemo, useState } from 'react';
import { Wallet, Search } from 'lucide-react';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuditStore } from '@/store/useAuditStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
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
import { round2, toNumber } from '@/utils/format';

export default function AccountsPayablePage(): React.JSX.Element {
  const purchases = usePurchaseStore((state) => state.purchases);
  const suppliers = useCatalogStore((state) => state.suppliers);
  const decreaseSupplierBalance = useCatalogStore((state) => state.decreaseSupplierBalance);
  const user = useSettingsStore((state) => state.currentUser);
  const addLog = useAuditStore((state) => state.addLog);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [payTarget, setPayTarget] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const rows = useMemo(() => {
    return purchases.map((p) => {
      const supplier = suppliers.find((s) => s.id === p.supplierId);
      const due = new Date(p.createdAt);
      due.setDate(due.getDate() + 30);
      const balance = supplier?.balance ?? 0;
      const status: 'paid' | 'partial' | 'pending' | 'overdue' =
        p.paymentMethod !== 'credit'
          ? 'paid'
          : balance <= 0.01
            ? 'paid'
            : new Date() > due
              ? 'overdue'
              : 'pending';
      return { purchase: p, supplier, due, balance, status };
    });
  }, [purchases, suppliers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !`${r.purchase.number} ${r.purchase.supplierName}`.toLowerCase().includes(term)) return false;
      if (statusFilter === 'pending' && r.status === 'paid') return false;
      if (statusFilter === 'paid' && r.status !== 'paid') return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    const pending = filtered
      .filter((r) => r.status !== 'paid')
      .reduce((acc, r) => acc + r.purchase.total, 0);
    return { pending };
  }, [filtered]);

  const handlePay = (supplierId: string): void => {
    const amount = round2(toNumber(payAmount));
    if (amount <= 0) return;
    decreaseSupplierBalance(supplierId, amount);
    addLog({
      action: 'supplier_payment',
      entity: 'Proveedor',
      entityId: supplierId,
      description: `Abono de C$ ${amount.toFixed(2)} registrado.`,
      userId: user.id,
      userName: user.name,
      metadata: { monto: amount },
    });
    toast.success('Abono registrado', `C$ ${amount.toFixed(2)}`);
    setPayTarget(null);
    setPayAmount('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Compras"
        title="Cuentas por pagar"
        description="Facturas de compra a crédito, saldos pendientes y abonos a proveedores."
        icon={<Wallet className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Facturas" value={String(filtered.length)} hint="En filtro" icon={<Wallet />} accent="blue" />
        <StatCard label="Pendiente" value={formatMoneyStat(totals.pending, rate)} hint="Por pagar" icon={<Wallet />} accent="amber" />
        <StatCard label="Proveedores" value={String(suppliers.filter((s) => s.type === 'purchase').length)} hint="De compra" icon={<Wallet />} accent="sky" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar factura o proveedor…"
              className="h-9 w-full rounded-md border border-border bg-muted/40 pl-9 pr-3 text-xs outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'paid')}
            className="h-9 rounded-md border border-border bg-muted/40 px-2.5 text-[11px]"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="paid">Pagadas</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Wallet />} title="Sin cuentas" description="No hay facturas de compra en este filtro." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.purchase.id}>
                  <TableCell className="num text-[11px] font-medium">{r.purchase.number}</TableCell>
                  <TableCell className="text-xs">{r.purchase.supplierName}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{formatDate(r.purchase.createdAt)}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{formatDate(r.due.toISOString())}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(r.purchase.total, rate)}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        r.status === 'paid'
                          ? 'bg-success/10 text-success'
                          : r.status === 'overdue'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-warning/10 text-warning',
                      )}
                    >
                      {r.status === 'paid' ? 'Pagada' : r.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'paid' ? (
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => {
                            setPayTarget(r.purchase.supplierId);
                            setPayAmount('');
                          }}
                        >
                          Abonar
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {payTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <p className="text-sm font-semibold">Registrar abono</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Proveedor: {suppliers.find((s) => s.id === payTarget)?.name}
            </p>
            <div className="mt-3 space-y-1.5">
              <Label>Monto (C$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="num"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPayTarget(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handlePay(payTarget)} disabled={toNumber(payAmount) <= 0}>
                Registrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}