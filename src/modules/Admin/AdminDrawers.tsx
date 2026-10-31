import { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  CreditCard,
  KeyRound,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import type { Customer, SupplierType, UserRole } from '@/types';
import { SideDrawer } from '@/components/shared/side-drawer';
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
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useAuditStore } from '@/store/useAuditStore';
import { toast } from '@/store/useToastStore';
import { formatMoney, round2, toNumber } from '@/utils/format';
import { cn } from '@/lib/utils';

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
  warehouse: 'Bodega',
};

interface UserDrawerProps {
  open: boolean;
  userId: string | null;
  onClose: () => void;
}

export function UserDrawer({ open, userId, onClose }: UserDrawerProps): React.JSX.Element {
  const users = useSettingsStore((state) => state.users);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const createUser = useSettingsStore((state) => state.createUser);
  const updateUser = useSettingsStore((state) => state.updateUser);
  const user = users.find((entry) => entry.id === userId) ?? null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setRole(user?.role ?? 'cashier');
    setPin('');
    setIsActive(user?.isActive ?? true);
    setError('');
    setSubmitting(false);
  }, [open, user]);

  const handleSubmit = (): void => {
    setError('');
    setSubmitting(true);
    try {
      if (!name.trim()) throw new Error('El nombre es obligatorio.');
      if (user) {
        updateUser(user.id, { name, email, role, pin, isActive });
        toast.success('Colaborador actualizado', `${name} · ${roleLabels[role]}`);
      } else {
        createUser({ name, email, role, pin, isActive });
        toast.success('Colaborador agregado', `${name} · ${roleLabels[role]}`);
      }
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar el colaborador.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={(value) => { if (!value) onClose(); }}
      title={user ? 'Editar colaborador' : 'Nuevo colaborador'}
      description={user ? `${user.email} · ${roleLabels[user.role]}` : 'Agrega un usuario al equipo operativo.'}
      icon={<UserCog className="h-4 w-4 text-primary" />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={submitting}>
            <Check className="h-4 w-4" /> Guardar colaborador
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-primary/15 bg-primary/[0.05] p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Control de acceso
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            El PIN se usa para autorizar operaciones sensibles. Los administradores pueden activar o desactivar colaboradores.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Nombre completo *</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del colaborador" />
        </div>
        <div className="space-y-1.5">
          <Label>Correo electrónico *</Label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@factus.ni" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>PIN {user ? '(dejar vacío para conservar)' : '(4 a 8 dígitos)'}</Label>
            <Input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="••••"
              className="num"
              maxLength={8}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold">Colaborador activo</p>
            <p className="text-[9px] text-muted-foreground">Puede iniciar sesión y operar en el sistema.</p>
          </div>
          <Switch
            checked={isActive}
            disabled={user?.id === currentUser.id}
            onCheckedChange={setIsActive}
            aria-label="Activar colaborador"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </SideDrawer>
  );
}

const VENDOR_CATEGORIES = [
  'Abarrotes',
  'Abarrotes y bebidas',
  'Lácteos',
  'Panadería',
  'Energía eléctrica',
  'Telecomunicaciones',
  'Mantenimiento',
  'Limpieza',
  'Transporte',
  'Otros',
];

interface VendorDrawerProps {
  open: boolean;
  supplierId: string | null;
  onClose: () => void;
}

export function VendorDrawer({ open, supplierId, onClose }: VendorDrawerProps): React.JSX.Element {
  const suppliers = useCatalogStore((state) => state.suppliers);
  const createSupplier = useCatalogStore((state) => state.createSupplier);
  const updateSupplier = useCatalogStore((state) => state.updateSupplier);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const addLog = useAuditStore((state) => state.addLog);
  const supplier = suppliers.find((entry) => entry.id === supplierId) ?? null;

  const [name, setName] = useState('');
  const [type, setType] = useState<SupplierType>('purchase');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState(VENDOR_CATEGORIES[0]);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(supplier?.name ?? '');
    setType(supplier?.type ?? 'purchase');
    setContactName(supplier?.contactName ?? '');
    setPhone(supplier?.phone ?? '');
    setEmail(supplier?.email ?? '');
    setAddress(supplier?.address ?? '');
    setCategory(supplier?.category ?? VENDOR_CATEGORIES[0]);
    setIsActive(supplier?.isActive ?? true);
    setError('');
    setSubmitting(false);
  }, [open, supplier]);

  const handleSubmit = (): void => {
    setError('');
    setSubmitting(true);
    try {
      if (!name.trim()) throw new Error('El nombre del proveedor es obligatorio.');
      const draft = {
        name: name.trim(),
        type,
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        category,
        isActive,
      };
      if (supplier) {
        updateSupplier(supplier.id, draft);
        addLog({
          action: 'supplier_updated',
          entity: 'Proveedor',
          entityId: supplier.id,
          description: `${supplier.name} actualizado como proveedor ${type === 'purchase' ? 'de inventario' : 'de gasto'}.`,
          userId: currentUser.id,
          userName: currentUser.name,
          metadata: { tipo: type, categoria: category, activo: isActive },
        });
        toast.success('Proveedor actualizado', `${name} · ${category}`);
      } else {
        const created = createSupplier(draft);
        addLog({
          action: 'supplier_created',
          entity: 'Proveedor',
          entityId: created.id,
          description: `${created.name} agregado como proveedor ${type === 'purchase' ? 'de inventario' : 'de gasto'}.`,
          userId: currentUser.id,
          userName: currentUser.name,
          metadata: { tipo: type, categoria: category },
        });
        toast.success('Proveedor agregado', `${name} · ${category}`);
      }
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar el proveedor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={(value) => { if (!value) onClose(); }}
      title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'}
      description={supplier ? `${supplier.category} · saldo ${formatMoney(supplier.balance)}` : 'Registra un vendor de inventario o de gasto.'}
      icon={<Building2 className="h-4 w-4 text-info" />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={submitting}>
            <Check className="h-4 w-4" /> Guardar proveedor
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Razón comercial *</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del proveedor" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de proveedor</Label>
            <Select value={type} onValueChange={(value) => setType(value as SupplierType)}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Inventario / compras</SelectItem>
                <SelectItem value="expense">Gastos / servicios</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_CATEGORIES.map((entry) => (
                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Contacto</Label>
            <Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Nombre del ejecutivo" />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+505 0000 0000" className="num" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Correo</Label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ventas@proveedor.ni" />
        </div>
        <div className="space-y-1.5">
          <Label>Dirección</Label>
          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Dirección fiscal o de entrega" />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold">Proveedor activo</p>
            <p className="text-[9px] text-muted-foreground">Disponible para compras y gastos.</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Activar proveedor" />
        </div>

        {supplier ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Saldo actual</span>
              <span className="num text-sm font-semibold text-warning">{formatMoney(supplier.balance)}</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </SideDrawer>
  );
}

interface CreditDrawerProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
}

export function CreditDrawer({ open, customer, onClose }: CreditDrawerProps): React.JSX.Element {
  const updateCustomer = useCatalogStore((state) => state.updateCustomer);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const addLog = useAuditStore((state) => state.addLog);

  const [authorized, setAuthorized] = useState(false);
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState('0');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setAuthorized(customer.creditAuthorized ?? customer.creditLimit > 0);
    setDays(customer.creditDays ?? 30);
    setLimit(String(customer.creditLimit));
    setError('');
    setSubmitting(false);
  }, [open, customer]);

  const parsedLimit = round2(toNumber(limit));
  const available = customer ? round2(Math.max(0, parsedLimit - customer.balance)) : 0;

  const handleSubmit = (): void => {
    if (!customer) return;
    setError('');
    setSubmitting(true);
    try {
      if (authorized) {
        if (!Number.isFinite(days) || days < 1 || days > 365) throw new Error('Los días de crédito deben estar entre 1 y 365.');
        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) throw new Error('El límite máximo debe ser mayor que cero.');
        if (parsedLimit + 0.01 < customer.balance) throw new Error('El límite no puede ser menor que el saldo actual del cliente.');
      }
      const updated = updateCustomer(customer.id, {
        name: customer.name,
        businessName: customer.businessName,
        taxId: customer.taxId,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        creditLimit: authorized ? parsedLimit : 0,
        notes: customer.notes,
        isActive: customer.isActive,
        creditAuthorized: authorized,
        creditDays: authorized ? days : 0,
      });
      addLog({
        action: 'customer_credit_updated',
        entity: 'Cliente',
        entityId: customer.id,
        description: authorized
          ? `Crédito autorizado para ${customer.name}: ${days} días, límite C$ ${parsedLimit.toFixed(2)}.`
          : `Crédito desautorizado para ${customer.name}.`,
        severity: authorized ? 'info' : 'warning',
        userId: currentUser.id,
        userName: currentUser.name,
        metadata: {
          autorizado: authorized,
          dias: authorized ? days : 0,
          limite: authorized ? parsedLimit : 0,
          saldo: updated.balance,
        },
      });
      toast.success(
        authorized ? 'Crédito actualizado' : 'Crédito desautorizado',
        authorized
          ? `${customer.name} · ${days} días · ${formatMoney(parsedLimit)}`
          : `${customer.name} ya no puede comprar a crédito.`,
      );
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo actualizar el crédito.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={(value) => { if (!value) onClose(); }}
      title="Crédito del cliente"
      description={customer ? `${customer.name} · saldo ${formatMoney(customer.balance)}` : 'Selecciona un cliente.'}
      icon={<CreditCard className="h-4 w-4 text-warning" />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={submitting}>
            <Check className="h-4 w-4" /> Guardar crédito
          </Button>
        </div>
      }
    >
      {customer ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">{customer.businessName || customer.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{customer.phone || 'Sin teléfono'} · {customer.taxId || 'Sin RUC'}</p>
              </div>
              <Badge variant={authorized ? 'success' : 'secondary'}>
                {authorized ? 'Crédito activo' : 'Solo contado'}
              </Badge>
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-3 transition-colors',
              authorized ? 'border-success/25 bg-success/[0.06]' : 'border-border bg-muted/40',
            )}
          >
            <div>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                <ShieldCheck className="h-4 w-4 text-success" /> Crédito autorizado
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Al activarlo se habilitan los días permitidos y el límite máximo.
              </p>
            </div>
            <Switch checked={authorized} onCheckedChange={setAuthorized} aria-label="Autorizar crédito" />
          </div>

          <div className={cn('grid gap-3 sm:grid-cols-2 transition-opacity', !authorized && 'opacity-45')}>
            <div className="space-y-1.5">
              <Label>Días permitidos</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={days}
                disabled={!authorized}
                onChange={(event) => setDays(Math.max(1, Math.round(toNumber(event.target.value))))}
                className="num"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Límite máximo (C$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={limit}
                disabled={!authorized}
                onChange={(event) => setLimit(event.target.value)}
                className="num"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saldo actual</p>
              <p className="num mt-0.5 text-sm font-bold text-warning">{formatMoney(customer.balance)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Disponible</p>
              <p className={cn('num mt-0.5 text-sm font-bold', available > 0 ? 'text-success' : 'text-destructive')}>
                {formatMoney(authorized ? available : 0)}
              </p>
            </div>
          </div>

          {authorized && parsedLimit < customer.balance ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[10px] text-destructive">
              El límite ingresado es menor que el saldo actual. Ajusta el límite o registra un abono.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          ) : null}

          <div className="rounded-md border border-primary/15 bg-primary/[0.04] px-3 py-2 text-[10px] leading-relaxed text-primary/80">
            <KeyRound className="mr-1 inline h-3 w-3" />
            Los cambios de crédito quedan registrados en la bitácora con el usuario que autorizó.
          </div>
        </div>
      ) : null}
    </SideDrawer>
  );
}
