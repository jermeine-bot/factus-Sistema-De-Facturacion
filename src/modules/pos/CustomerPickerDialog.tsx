import { useMemo, useState } from 'react';
import { BadgeCheck, CreditCard, Search, UserPlus, UserRound, UserX } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { toast } from '@/store/useToastStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/utils/format';
import { useSettingsStore } from '@/store/useSettingsStore';
import { cn } from '@/lib/utils';

interface CustomerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (customerId: string | null) => void;
}

export function CustomerPickerDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: CustomerPickerDialogProps): React.JSX.Element {
  const customers = useCatalogStore((state) => state.customers);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const [search, setSearch] = useState('');
  const createCustomer = useCatalogStore((state) => state.createCustomer);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter(
      (customer) =>
        customer.isActive &&
        (term.length === 0 ||
          customer.name.toLowerCase().includes(term) ||
          customer.businessName.toLowerCase().includes(term) ||
          customer.taxId.toLowerCase().includes(term) ||
          customer.phone.includes(term)),
    );
  }, [customers, search]);

  const handleCreate = (): void => {
    try {
      if (!name.trim()) throw new Error('El nombre del cliente es obligatorio.');
      const customer = createCustomer({
        name: name.trim(),
        businessName: '',
        taxId: taxId.trim(),
        phone: phone.trim(),
        email: '',
        address: '',
        creditLimit: Number(creditLimit) || 0,
        notes: '',
        isActive: true,
      });
      toast.success('Cliente creado', customer.name);
      onSelect(customer.id);
      onOpenChange(false);
      setCreating(false);
      setName('');
      setPhone('');
      setTaxId('');
      setCreditLimit('0');
    } catch (error) {
      toast.error('No se pudo crear', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" /> Asignar cliente
          </DialogTitle>
          <DialogDescription>
            El cliente define la factura, el crédito disponible y el historial de la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, RUC o teléfono…"
            className="pl-9"
            autoFocus
          />
        </div>

        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <UserPlus className="h-3.5 w-3.5" /> Registrar cliente rápido sin salir del POS
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold">Nuevo cliente</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre *" />
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Teléfono" />
            <Input value={taxId} onChange={(event) => setTaxId(event.target.value)} placeholder="RUC" />
            <Input type="number" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} placeholder="Límite de crédito" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate}>Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onOpenChange(false);
          }}
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
            selectedId === null
              ? 'border-primary/35 bg-primary/10'
              : 'border-border bg-muted/40 hover:bg-muted/40',
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
              <UserX className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold">Consumidor Final</p>
              <p className="text-[10px] text-muted-foreground">Venta de contado sin datos fiscales</p>
            </div>
          </div>
          <Badge variant="secondary">Contado</Badge>
        </button>

        <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((customer) => {
            const available = Math.max(0, customer.creditLimit - customer.balance);
            const usage = customer.creditLimit > 0 ? (customer.balance / customer.creditLimit) * 100 : 100;
            const exhausted = available <= 0;
            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onSelect(customer.id);
                  onOpenChange(false);
                }}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-all',
                  selectedId === customer.id
                    ? 'border-primary/35 bg-primary/10'
                    : 'border-border bg-muted/40 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-muted/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/15"
                      style={{ backgroundColor: exhausted ? '#64748b' : '#2563eb' }}
                    >
                      {customer.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{customer.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {customer.businessName || customer.taxId || 'Sin datos fiscales'}
                      </p>
                    </div>
                  </div>
                  {exhausted ? (
                    <Badge variant="danger" className="shrink-0">
                      Sin crédito
                    </Badge>
                  ) : (
                    <Badge variant="success" className="shrink-0">
                      <BadgeCheck /> {formatMoney(available, rate)}
                    </Badge>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn('h-full rounded-full', usage > 85 ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.min(100, usage)}%` }}
                    />
                  </div>
                  <span className="num shrink-0 text-[9px] text-muted-foreground">
                    Saldo {formatMoney(customer.balance, rate)} / {formatMoney(customer.creditLimit, rate)}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <CreditCard className="mx-auto h-5 w-5 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">No hay clientes que coincidan.</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
