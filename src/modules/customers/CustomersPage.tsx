import { useMemo, useState } from 'react';
import {
  Banknote,
  Check,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  Landmark,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { Customer } from '@/types';
import { useCatalogStore, type CustomerDraft } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCashStore } from '@/store/useCashStore';
import { useAuditStore } from '@/store/useAuditStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMoney, formatMoneyStat, formatNumber, initials, round2, toNumber } from '@/utils/format';
import { cn } from '@/lib/utils';

type CreditFilter = 'all' | 'available' | 'near-limit' | 'exhausted';

const emptyDraft: CustomerDraft = {
  name: '',
  businessName: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  creditLimit: 0,
  notes: '',
  isActive: true,
};

export default function CustomersPage(): React.JSX.Element {
  const customers = useCatalogStore((state) => state.customers);
  const createCustomer = useCatalogStore((state) => state.createCustomer);
  const updateCustomer = useCatalogStore((state) => state.updateCustomer);
  const toggleCustomerActive = useCatalogStore((state) => state.toggleCustomerActive);
  const decreaseCustomerBalance = useCatalogStore((state) => state.decreaseCustomerBalance);
  const settings = useSettingsStore((state) => state.settings);
  const user = useSettingsStore((state) => state.currentUser);
  const cashSession = useCashStore((state) => state.current);
  const addMovement = useCashStore((state) => state.addMovement);
  const addLog = useAuditStore((state) => state.addLog);

  const rate = settings.exchangeRate;

  const [search, setSearch] = useState('');
  const [creditFilter, setCreditFilter] = useState<CreditFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);
  const [formError, setFormError] = useState('');

  const [paymentTarget, setPaymentTarget] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const stats = useMemo(() => {
    const active = customers.filter((customer) => customer.isActive);
    const totalLimit = active.reduce((acc, customer) => acc + customer.creditLimit, 0);
    const totalBalance = active.reduce((acc, customer) => acc + customer.balance, 0);
    const exhausted = active.filter((customer) => customer.creditLimit > 0 && customer.balance >= customer.creditLimit).length;
    return {
      active: active.length,
      totalLimit,
      totalBalance,
      available: Math.max(0, totalLimit - totalBalance),
      exhausted,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers
      .filter((customer) => {
        if (!showInactive && !customer.isActive) return false;
        if (term && !`${customer.name} ${customer.businessName} ${customer.taxId} ${customer.phone} ${customer.email}`.toLowerCase().includes(term)) {
          return false;
        }
        const usage = customer.creditLimit > 0 ? customer.balance / customer.creditLimit : 0;
        if (creditFilter === 'available') return customer.creditLimit > customer.balance;
        if (creditFilter === 'near-limit') return usage >= 0.8 && usage < 1;
        if (creditFilter === 'exhausted') return customer.creditLimit > 0 && usage >= 1;
        return true;
      })
      .sort((a, b) => b.balance - a.balance);
  }, [customers, search, creditFilter, showInactive]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openCreate = (): void => {
    setEditing(null);
    setDraft({ ...emptyDraft });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (customer: Customer): void => {
    setEditing(customer);
    setDraft({
      name: customer.name,
      businessName: customer.businessName,
      taxId: customer.taxId,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      creditLimit: customer.creditLimit,
      notes: customer.notes,
      isActive: customer.isActive,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (): void => {
    setFormError('');
    try {
      if (!draft.name.trim()) throw new Error('El nombre del cliente es obligatorio.');
      if (!Number.isFinite(draft.creditLimit) || draft.creditLimit < 0) throw new Error('El límite de crédito no puede ser negativo.');
      const payload: CustomerDraft = {
        ...draft,
        name: draft.name.trim(),
        businessName: draft.businessName.trim(),
        creditLimit: round2(draft.creditLimit),
      };
      if (editing) {
        updateCustomer(editing.id, payload);
        toast.success('Cliente actualizado', payload.name);
      } else {
        createCustomer(payload);
        toast.success('Cliente creado', payload.name);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el cliente.');
    }
  };

  const openPayment = (customer: Customer): void => {
    setPaymentTarget(customer);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentRef('');
    setPaymentError('');
  };

  const handlePayment = (): void => {
    if (!paymentTarget) return;
    setPaymentError('');
    try {
      const amount = round2(toNumber(paymentAmount));
      if (amount <= 0) throw new Error('El abono debe ser mayor que cero.');
      if (amount > paymentTarget.balance + 0.01) {
        throw new Error(`El abono excede el saldo de ${formatMoney(paymentTarget.balance, rate)}.`);
      }
      if (paymentMethod === 'cash' && !cashSession) {
        throw new Error('Abre la caja para registrar abonos en efectivo.');
      }
      if (paymentMethod === 'cash') {
        addMovement({
          type: 'credit_payment',
          amount,
          concept: `Abono de ${paymentTarget.name}`,
          reference: paymentRef.trim() || `ABONO-${paymentTarget.id}`,
          userName: user.name,
        });
      }
      decreaseCustomerBalance(paymentTarget.id, amount);
      addLog({
        action: 'credit_payment',
        entity: 'Cliente',
        entityId: paymentTarget.id,
        description: `Abono de ${formatMoney(amount, rate)} recibido de ${paymentTarget.name} por ${paymentMethod === 'cash' ? 'efectivo' : 'transferencia'}.`,
        userId: user.id,
        userName: user.name,
        metadata: {
          monto: amount,
          metodo: paymentMethod,
          saldoAnterior: paymentTarget.balance,
          saldoNuevo: round2(paymentTarget.balance - amount),
        },
      });
      toast.success('Abono registrado', `${paymentTarget.name} · saldo ${formatMoney(round2(paymentTarget.balance - amount), rate)}`);
      setPaymentTarget(null);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'No se pudo registrar el abono.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catálogo"
        title="Clientes y crédito"
        description="Administra límites de crédito, saldos pendientes y abonos. El POS bloquea ventas que excedan el límite disponible."
        icon={<Users className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={openCreate}>
            <UserPlus className="h-3.5 w-3.5" /> Nuevo cliente
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes activos" value={String(stats.active)} hint={`${customers.length} registrados en total`} icon={<Users />} accent="blue" />
        <StatCard label="Crédito otorgado" value={formatMoneyStat(stats.totalLimit, rate)} hint="Suma de límites aprobados" icon={<ShieldCheck />} accent="sky" />
        <StatCard label="Saldo por cobrar" value={formatMoneyStat(stats.totalBalance, rate)} hint={`${stats.exhausted} clientes con límite agotado`} icon={<HandCoins />} accent="amber" />
        <StatCard label="Disponible total" value={formatMoneyStat(stats.available, rate)} hint="Capacidad de crédito restante" icon={<CircleDollarSign />} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Buscar nombre, RUC, teléfono…"
            className="w-full lg:max-w-xs"
          />
          <Select value={creditFilter} onValueChange={(value) => { setCreditFilter(value as CreditFilter); setPage(1); }}>
            <SelectTrigger className="h-9 w-[170px] text-[11px]">
              <SelectValue placeholder="Crédito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              <SelectItem value="available">Con crédito disponible</SelectItem>
              <SelectItem value="near-limit">Cerca del límite</SelectItem>
              <SelectItem value="exhausted">Límite agotado</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-[11px] text-muted-foreground">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Ver inactivos
          </label>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> {filtered.length} clientes
          </div>
        </div>

        {paginated.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Sin clientes en este filtro"
            description="Ajusta los filtros o registra un nuevo cliente para gestionar su crédito."
            action={<Button size="sm" onClick={openCreate}><Plus /> Nuevo cliente</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-[180px]">Uso de crédito</TableHead>
                <TableHead className="text-right">Límite</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((customer) => {
                const usage = customer.creditLimit > 0 ? Math.min(100, (customer.balance / customer.creditLimit) * 100) : 0;
                const available = Math.max(0, customer.creditLimit - customer.balance);
                const over = customer.creditLimit > 0 && customer.balance >= customer.creditLimit;
                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/10 text-[10px] font-bold text-primary">
                          {initials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{customer.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {customer.businessName || 'Persona natural'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="num text-[11px]">{customer.phone || 'Sin teléfono'}</p>
                      <p className="num text-[10px] text-muted-foreground">{customer.taxId || 'Sin RUC'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              usage >= 100
                                ? 'bg-destructive'
                                : usage >= 80
                                  ? 'bg-warning'
                                  : 'bg-gradient-to-r from-primary to-info',
                            )}
                            style={{ width: `${usage}%` }}
                          />
                        </div>
                        <p className={cn('num text-[10px]', usage >= 100 ? 'text-destructive' : 'text-muted-foreground')}>
                          {formatNumber(usage, 0)}% usado
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="num text-right text-xs">{formatMoney(customer.creditLimit, rate)}</TableCell>
                    <TableCell className="num text-right text-xs font-semibold text-warning">{formatMoney(customer.balance, rate)}</TableCell>
                    <TableCell className={cn('num text-right text-xs font-semibold', over ? 'text-destructive' : 'text-success')}>
                      {formatMoney(available, rate)}
                    </TableCell>
                    <TableCell>
                      {customer.isActive ? (
                        over ? <Badge variant="danger">Límite agotado</Badge> : <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => openPayment(customer)}
                          disabled={customer.balance <= 0}
                          title="Registrar abono"
                        >
                          <HandCoins className="h-3.5 w-3.5" /> Abonar
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(customer)} aria-label="Editar cliente">
                          <PenLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            toggleCustomerActive(customer.id);
                            toast.info(
                              customer.isActive ? 'Cliente desactivado' : 'Cliente activado',
                              customer.name,
                            );
                          }}
                          aria-label={customer.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                          className={customer.isActive ? 'text-destructive/70 hover:text-destructive' : 'text-success/70 hover:text-success'}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {filtered.length > pageSize ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>Página {safePage} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Siguiente</Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Formulario */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <PenLine className="h-4 w-4 text-primary" /> : <UserPlus className="h-4 w-4 text-primary" />}
              {editing ? 'Editar cliente' : 'Nuevo cliente'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'El saldo actual no se modifica desde este formulario; usa Abonar o una venta a crédito.' : 'Define el límite de crédito para habilitar ventas a crédito en el POS.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="María Fernanda Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label>Razón social / negocio</Label>
              <Input value={draft.businessName} onChange={(event) => setDraft({ ...draft, businessName: event.target.value })} placeholder="Pulpería Doña Marta" />
            </div>
            <div className="space-y-1.5">
              <Label>RUC</Label>
              <Input value={draft.taxId} onChange={(event) => setDraft({ ...draft, taxId: event.target.value })} placeholder="001-220485-0007K" className="num" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+505 8888 0000" className="num" />
            </div>
            <div className="space-y-1.5">
              <Label>Correo electrónico</Label>
              <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="cliente@correo.ni" />
            </div>
            <div className="space-y-1.5">
              <Label>Límite de crédito (C$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.creditLimit}
                onChange={(event) => setDraft({ ...draft, creditLimit: toNumber(event.target.value) })}
                className="num"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} placeholder="Barrio, ciudad" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notas</Label>
              <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={2} placeholder="Condiciones de pago, frecuencia de compra…" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 sm:col-span-2">
              <div>
                <p className="text-xs font-medium">Cliente activo</p>
                <p className="text-[10px] text-muted-foreground">Los clientes inactivos no aparecen en el POS</p>
              </div>
              <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
            </div>
          </div>

          {editing ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              Saldo actual: <span className="num font-semibold text-warning">{formatMoney(editing.balance, rate)}</span>
              {' · '}Disponible: <span className="num font-semibold text-success">{formatMoney(Math.max(0, editing.creditLimit - editing.balance), rate)}</span>
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{formError}</div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4" /> {editing ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abono */}
      <Dialog open={Boolean(paymentTarget)} onOpenChange={(open) => { if (!open) setPaymentTarget(null); }}>
        <DialogContent className="max-w-md">
          {paymentTarget ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-success" /> Registrar abono
                </DialogTitle>
                <DialogDescription>
                  {paymentTarget.name} · Saldo pendiente {formatMoney(paymentTarget.balance, rate)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                  <p className="text-muted-foreground">Límite</p>
                  <p className="num mt-0.5 text-sm font-semibold">{formatMoney(paymentTarget.creditLimit, rate)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                  <p className="text-muted-foreground">Saldo</p>
                  <p className="num mt-0.5 text-sm font-semibold text-warning">{formatMoney(paymentTarget.balance, rate)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Monto del abono (C$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder={paymentTarget.balance.toFixed(2)}
                  className="num text-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'cash' as const, label: 'Efectivo', icon: Banknote },
                  { id: 'transfer' as const, label: 'Transferencia', icon: Landmark },
                ]).map((entry) => {
                  const Icon = entry.icon;
                  const active = paymentMethod === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setPaymentMethod(entry.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors',
                        active
                          ? 'border-success/35 bg-success/10 text-success'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/40',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {entry.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label>Referencia</Label>
                <Input value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} placeholder="Recibo, transferencia…" className="num" />
              </div>

              {paymentMethod === 'cash' ? (
                <p className={cn('flex items-center gap-1.5 text-[10px]', cashSession ? 'text-success' : 'text-destructive')}>
                  <Wallet className="h-3 w-3" />
                  {cashSession ? `Se sumará a la caja de ${cashSession.openedBy}.` : 'No hay caja abierta para recibir efectivo.'}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <CreditCard className="h-3 w-3" /> Se reduce el saldo sin afectar la gaveta.
                </p>
              )}

              {paymentError ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{paymentError}</div>
              ) : null}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setPaymentTarget(null)}>Cancelar</Button>
                <Button variant="success" onClick={handlePayment} disabled={toNumber(paymentAmount) <= 0}>
                  <Check className="h-4 w-4" /> Registrar abono
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
