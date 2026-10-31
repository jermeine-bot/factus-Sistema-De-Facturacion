import { useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CreditCard,
  Droplets,
  Landmark,
  Lightbulb,
  Plus,
  Receipt,
  Search,
  TrendingDown,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { Expense, Supplier } from '@/types';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
  formatDate,
  formatMoney,
  formatMoneyStat,
  round2,
  toNumber,
} from '@/utils/format';
import { cn } from '@/lib/utils';

const EXPENSE_CATEGORIES = [
  'Servicios básicos',
  'Telecomunicaciones',
  'Mantenimiento',
  'Limpieza',
  'Transporte',
  'Papelería',
  'Publicidad',
  'Otros',
];

const paymentMeta: Record<Expense['paymentMethod'], { label: string; variant: 'success' | 'warning' | 'info'; icon: typeof Banknote }> = {
  cash: { label: 'Efectivo', variant: 'success', icon: Banknote },
  credit: { label: 'Crédito', variant: 'warning', icon: CreditCard },
  transfer: { label: 'Transferencia', variant: 'info', icon: Landmark },
};

function providerIcon(category: string): typeof Zap {
  const value = category.toLowerCase();
  if (value.includes('energ')) return Zap;
  if (value.includes('telecom') || value.includes('internet')) return Wifi;
  if (value.includes('agua')) return Droplets;
  if (value.includes('manten')) return Wrench;
  if (value.includes('limp')) return Droplets;
  return Lightbulb;
}

function categoryForSupplier(supplier?: Supplier): string {
  if (!supplier) return EXPENSE_CATEGORIES[0];
  const value = `${supplier.category} ${supplier.name}`.toLowerCase();
  if (value.includes('energ') || value.includes('agua')) return 'Servicios básicos';
  if (value.includes('telecom') || value.includes('claro') || value.includes('internet')) {
    return 'Telecomunicaciones';
  }
  return 'Otros';
}

export default function ExpensesModule(): React.JSX.Element {
  const expenses = usePurchaseStore((state) => state.expenses);
  const createExpense = usePurchaseStore((state) => state.createExpense);
  const suppliers = useCatalogStore((state) => state.suppliers);
  const settings = useSettingsStore((state) => state.settings);
  const cashSession = useCashStore((state) => state.current);

  const rate = settings.exchangeRate;
  const cashAvailable = cashSession ? sessionExpected(cashSession) : 0;
  const expenseSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.type === 'expense' && supplier.isActive),
    [suppliers],
  );

  const [supplierId, setSupplierId] = useState(expenseSuppliers[0]?.id ?? '');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState(
    categoryForSupplier(expenseSuppliers[0]),
  );
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Expense['paymentMethod']>('transfer');
  const [isCashDrawerExpense, setIsCashDrawerExpense] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const selectedSupplier = expenseSuppliers.find((supplier) => supplier.id === supplierId);

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const month = expenses.filter((expense) => new Date(expense.createdAt) >= monthStart);
    return {
      monthTotal: month.reduce((acc, expense) => acc + expense.amount, 0),
      monthCount: month.length,
      cash: expenses
        .filter((expense) => expense.isCashDrawerExpense)
        .reduce((acc, expense) => acc + expense.amount, 0),
      credit: expenses
        .filter((expense) => expense.paymentMethod === 'credit')
        .reduce((acc, expense) => acc + expense.amount, 0),
    };
  }, [expenses]);

  const categories = useMemo(
    () => Array.from(new Set([...EXPENSE_CATEGORIES, ...expenses.map((expense) => expense.category)])),
    [expenses],
  );

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses
      .filter((expense) => {
        if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
        if (!term) return true;
        return `${expense.number} ${expense.supplierName} ${expense.concept} ${expense.invoiceRef}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [expenses, search, categoryFilter]);

  const handleSupplier = (value: string): void => {
    const supplier = expenseSuppliers.find((entry) => entry.id === value);
    setSupplierId(value);
    setCategory(categoryForSupplier(supplier));
  };

  const handlePaymentMethod = (value: Expense['paymentMethod']): void => {
    setPaymentMethod(value);
    if (value !== 'cash') setIsCashDrawerExpense(false);
  };

  const resetForm = (): void => {
    setConcept('');
    setAmount('');
    setInvoiceRef('');
    setFormError('');
    setPaymentMethod('transfer');
    setIsCashDrawerExpense(false);
  };

  const handleSubmit = (): void => {
    setFormError('');
    setSubmitting(true);
    try {
      const expense = createExpense({
        supplierId,
        concept,
        category,
        amount: toNumber(amount),
        paymentMethod,
        isCashDrawerExpense,
        invoiceRef: invoiceRef.trim(),
      });
      toast.success(
        `Gasto ${expense.number} registrado`,
        `${expense.concept} · ${formatMoney(expense.amount, rate)}`,
      );
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo registrar el gasto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gastos operativos"
        title="Servicios y proveedores de gasto"
        description="Registra energía eléctrica, internet, mantenimiento y otros servicios con afectación opcional a la caja del día."
        icon={<TrendingDown className="h-5 w-5" />}
        actions={
          <Badge variant={cashSession ? 'success' : 'warning'} className="h-8 px-3">
            <Wallet className="h-3 w-3" />
            {cashSession ? 'Caja abierta' : 'Caja cerrada'}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gastos del mes" value={formatMoneyStat(stats.monthTotal, rate)} hint={`${stats.monthCount} servicios registrados`} icon={<Receipt />} accent="rose" />
        <StatCard label="Pagado desde caja" value={formatMoneyStat(stats.cash, rate)} hint="Histórico con salida de efectivo" icon={<Wallet />} accent="amber" />
        <StatCard label="Gastos a crédito" value={formatMoneyStat(stats.credit, rate)} hint="Pendiente con proveedores de gasto" icon={<CreditCard />} accent="blue" />
        <StatCard label="Proveedores de gasto" value={String(expenseSuppliers.length)} hint="Catálogo de servicios activos" icon={<Building2 />} accent="sky" />
      </div>

      <div className="grid items-start gap-4 2xl:grid-cols-[370px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
                  <Zap className="h-3.5 w-3.5 text-warning" /> Gasto rápido
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Servicios básicos y proveedores de gasto.
                </p>
              </div>
              <Badge variant="secondary">Expense supplier</Badge>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="space-y-1.5">
              <Label>Proveedor de gasto *</Label>
              <Select value={supplierId} onValueChange={handleSupplier}>
                <SelectTrigger className="h-9 text-[11px]">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {expenseSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {expenseSuppliers.map((supplier) => {
                  const Icon = providerIcon(supplier.category);
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      onClick={() => handleSupplier(supplier.id)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium transition-colors',
                        supplierId === supplier.id
                          ? 'border-warning/30 bg-warning/10 text-warning'
                          : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" /> {supplier.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((entry) => (
                      <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="num h-9 text-right text-xs font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Concepto *</Label>
              <Input
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="Ej. Energía eléctrica de octubre"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Forma de pago</Label>
                <Select value={paymentMethod} onValueChange={(value) => handlePaymentMethod(value as Expense['paymentMethod'])}>
                  <SelectTrigger className="h-9 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Factura / recibo</Label>
                <Input
                  value={invoiceRef}
                  onChange={(event) => setInvoiceRef(event.target.value)}
                  placeholder="REC-0000"
                  className="num h-9 text-xs"
                />
              </div>
            </div>

            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
                isCashDrawerExpense
                  ? 'border-warning/25 bg-warning/[0.07]'
                  : 'border-border bg-muted/40',
              )}
            >
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <Banknote className="h-3.5 w-3.5 text-warning" /> Sale de caja
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  {paymentMethod === 'cash'
                    ? `Disponible ${formatMoney(cashAvailable, rate)}`
                    : 'Solo aplica a pagos en efectivo'}
                </p>
              </div>
              <Switch
                checked={isCashDrawerExpense}
                disabled={paymentMethod !== 'cash'}
                onCheckedChange={setIsCashDrawerExpense}
                aria-label="Deducir gasto desde la caja"
              />
            </div>

            {selectedSupplier ? (
              <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[9px] leading-relaxed text-muted-foreground">
                Proveedor de gasto: <span className="text-foreground/85">{selectedSupplier.name}</span>
                {selectedSupplier.contactName ? ` · ${selectedSupplier.contactName}` : ''}
                {selectedSupplier.phone ? ` · ${selectedSupplier.phone}` : ''}
              </p>
            ) : null}

            {formError ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
                {formError}
              </p>
            ) : null}

            <Button className="w-full" onClick={handleSubmit} loading={submitting}>
              <Plus className="h-4 w-4" /> Registrar gasto
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar gasto, proveedor o concepto…"
              className="w-full lg:max-w-xs"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[180px] text-[11px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((entry) => (
                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <Search className="h-3.5 w-3.5" /> {filteredExpenses.length} gastos
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <EmptyState
              icon={<Receipt />}
              title="Sin gastos en este filtro"
              description="Registra el primer servicio con el formulario rápido."
            />
          ) : (
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Gasto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => {
                  const meta = paymentMeta[expense.paymentMethod];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={expense.id}>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
                            <TrendingDown className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="num text-xs font-semibold">{expense.number}</p>
                            <p className="text-[9px] text-muted-foreground">{formatDate(expense.createdAt)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-medium">{expense.supplierName}</TableCell>
                      <TableCell className="py-2.5">
                        <p className="max-w-[220px] truncate text-[11px]">{expense.concept}</p>
                        {expense.invoiceRef ? (
                          <p className="num text-[9px] text-muted-foreground">Ref. {expense.invoiceRef}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-2.5"><Badge variant="secondary">{expense.category}</Badge></TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={meta.variant}><Icon /> {meta.label}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {expense.isCashDrawerExpense ? (
                          <Badge variant="danger">Salió de caja</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No aplica</span>
                        )}
                      </TableCell>
                      <TableCell className="num py-2.5 text-right text-[11px] font-semibold">
                        {formatMoney(expense.amount, rate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Wrench className="h-3 w-3" /> Proveedores de gasto activos: {expenseSuppliers.length}
            </span>
            <span className="num">
              Total filtrado: {formatMoney(round2(filteredExpenses.reduce((acc, expense) => acc + expense.amount, 0)), rate)}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
