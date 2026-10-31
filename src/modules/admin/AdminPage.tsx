import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Check,
  Coins,
  Eye,
  FileClock,
  KeyRound,
  Mail,
  Percent,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import type { AuditAction, AuditLog, AuditSeverity, UserRole } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime, formatNumber, formatTime, initials, round2, toNumber } from '@/utils/format';
import { cn } from '@/lib/utils';


type AdminTab = 'config' | 'usuarios' | 'auditoria';

const roleMeta: Record<UserRole, { label: string; variant: 'default' | 'info' | 'secondary' }> = {
  admin: { label: 'Administrador', variant: 'default' },
  supervisor: { label: 'Supervisor', variant: 'info' },
  cashier: { label: 'Cajero', variant: 'info' },
  warehouse: { label: 'Bodega', variant: 'secondary' },
};

const severityMeta: Record<AuditSeverity, { label: string; variant: 'secondary' | 'warning' | 'danger' }> = {
  info: { label: 'Informativo', variant: 'secondary' },
  warning: { label: 'Advertencia', variant: 'warning' },
  critical: { label: 'Crítico', variant: 'danger' },
};

const actionLabels: Record<AuditAction, string> = {
  sale_completed: 'Venta completada',
  sale_voided: 'Venta anulada',
  credit_note_created: 'Nota de crédito emitida',
  proforma_created: 'Proforma creada',
  proforma_converted: 'Proforma convertida',
  product_created: 'Producto creado',
  product_updated: 'Producto actualizado',
  stock_adjusted: 'Ajuste de stock',
  credit_sale: 'Venta a crédito',
  credit_limit_blocked: 'Límite bloqueado',
  credit_payment: 'Abono de crédito',
  purchase_created: 'Compra registrada',
  purchase_order_created: 'Orden de compra creada',
  purchase_order_received: 'Orden de compra recibida',
  supplier_payment: 'Abono a proveedor',
  supplier_created: 'Proveedor creado',
  supplier_updated: 'Proveedor actualizado',
  customer_credit_updated: 'Crédito de cliente actualizado',
  user_created: 'Usuario creado',
  user_updated: 'Usuario actualizado',
  expense_created: 'Gasto registrado',
  cash_opened: 'Caja abierta',
  cash_closed: 'Caja cerrada',
  cash_movement: 'Movimiento de caja',
  login: 'Inicio de sesión',
  settings_updated: 'Configuración actualizada',
};

interface SettingsForm {
  companyName: string;
  legalName: string;
  rnc: string;
  address: string;
  phone: string;
  email: string;
  footerMessage: string;
  taxRate: number;
  invoicePrefix: string;
  proformaPrefix: string;
  purchasePrefix: string;
  expensePrefix: string;
  cashDrawerRequired: boolean;
  lowStockAlert: boolean;
  companyLogo: string | null;
}

export default function AdminPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: AdminTab = rawTab === 'usuarios' || rawTab === 'auditoria' ? rawTab : 'config';

  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const updateExchangeRate = useSettingsStore((state) => state.updateExchangeRate);
  const users = useSettingsStore((state) => state.users);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const toggleUserActive = useSettingsStore((state) => state.toggleUserActive);
  const logs = useAuditStore((state) => state.logs);

  const [form, setForm] = useState<SettingsForm>({
    companyName: settings.companyName,
    legalName: settings.legalName,
    rnc: settings.rnc,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    footerMessage: settings.footerMessage,
    taxRate: round2(settings.taxRate * 100),
    invoicePrefix: settings.invoicePrefix,
    proformaPrefix: settings.proformaPrefix,
    purchasePrefix: settings.purchasePrefix,
    expensePrefix: settings.expensePrefix,
    cashDrawerRequired: settings.cashDrawerRequired,
    lowStockAlert: settings.lowStockAlert,
    companyLogo: settings.companyLogo ?? null,
  });
  const [rateInput, setRateInput] = useState(String(settings.exchangeRate));
  const uiTheme = useUIStore((state) => state.theme);
  const setUiTheme = useUIStore((state) => state.setTheme);
  const [themeChoice, setThemeChoice] = useState<'dark' | 'light'>(uiTheme);

  const [auditSearch, setAuditSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | AuditSeverity>('all');
  const [actionFilter, setActionFilter] = useState<'all' | AuditAction>('all');
  const [logDetail, setLogDetail] = useState<AuditLog | null>(null);

  const setTab = (value: string): void => {
    if (value === 'config') {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleSaveSettings = (): void => {
    try {
      if (!form.companyName.trim() || !form.legalName.trim()) throw new Error('El nombre comercial y la razón social son obligatorios.');
      if (!form.invoicePrefix.trim() || !form.proformaPrefix.trim()) throw new Error('Los prefijos de factura y proforma son obligatorios.');
      if (!Number.isFinite(form.taxRate) || form.taxRate < 0 || form.taxRate > 100) throw new Error('La tasa de IVA debe estar entre 0 y 100.');
      updateSettings({
        companyName: form.companyName.trim(),
        legalName: form.legalName.trim(),
        rnc: form.rnc.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        footerMessage: form.footerMessage.trim(),
        taxRate: round2(form.taxRate / 100),
        invoicePrefix: form.invoicePrefix.trim(),
        proformaPrefix: form.proformaPrefix.trim(),
        purchasePrefix: form.purchasePrefix.trim(),
        expensePrefix: form.expensePrefix.trim(),
        cashDrawerRequired: form.cashDrawerRequired,
        lowStockAlert: form.lowStockAlert,
        companyLogo: form.companyLogo,
      });
      toast.success('Configuración guardada', 'Los parámetros se aplican a todos los módulos.');
    } catch (error) {
      toast.error('No se pudo guardar', error instanceof Error ? error.message : undefined);
    }
  };

  const handleSaveRate = (): void => {
    try {
      updateExchangeRate(round2(toNumber(rateInput)));
      toast.success('Tasa de cambio actualizada', `C$${round2(toNumber(rateInput)).toFixed(2)} por USD.`);
    } catch (error) {
      toast.error('Tasa inválida', error instanceof Error ? error.message : undefined);
    }
  };

  const handleLogoFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Formato no válido', 'Selecciona una imagen (PNG, JPG o SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Archivo muy grande', 'El logotipo debe pesar menos de 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((previous) => ({ ...previous, companyLogo: String(reader.result) }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleApplyTheme = (): void => {
    setUiTheme(themeChoice);
    toast.success('Apariencia actualizada', themeChoice === 'dark' ? 'Modo oscuro activado.' : 'Modo claro activado.');
  };

  const auditStats = useMemo(() => {
    const critical = logs.filter((log) => log.severity === 'critical').length;
    const warning = logs.filter((log) => log.severity === 'warning').length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = logs.filter((log) => new Date(log.createdAt) >= today).length;
    return { critical, warning, todayCount };
  }, [logs]);

  const availableActions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return logs
      .filter((log) => {
        if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        if (term && !`${log.description} ${log.userName} ${log.entity} ${actionLabels[log.action]}`.toLowerCase().includes(term)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs, auditSearch, severityFilter, actionFilter]);

  const activeUsers = users.filter((user) => user.isActive).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Administración"
        description="Configura la empresa, la tasa de cambio, los usuarios y consulta la bitácora de auditoría inmutable."
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <Badge variant="secondary" className="h-8 px-3">
            <BadgeCheck className="h-3.5 w-3.5" /> Sesión: {currentUser.name}
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="config"><Settings2 /> Configuración</TabsTrigger>
          <TabsTrigger value="usuarios"><Users /> Usuarios</TabsTrigger>
          <TabsTrigger value="auditoria"><FileClock /> Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tasa de cambio" value={`C$ ${formatNumber(settings.exchangeRate, 2)}`} hint="Por cada dólar estadounidense" icon={<Coins />} accent="sky" />
            <StatCard label="IVA aplicado" value={`${formatNumber(settings.taxRate * 100, 0)}%`} hint="Incluido en precios de venta" icon={<Percent />} accent="blue" />
            <StatCard label="Caja obligatoria" value={settings.cashDrawerRequired ? 'Sí' : 'No'} hint="Bloquea cobros en efectivo sin sesión" icon={<ShieldAlert />} accent={settings.cashDrawerRequired ? 'amber' : 'emerald'} />
            <StatCard label="Alertas de stock" value={settings.lowStockAlert ? 'Activas' : 'Inactivas'} hint="Avisos de reposición en dashboard" icon={<Activity />} accent="emerald" />
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <div>
                  <h2 className="font-display text-sm font-semibold">Datos de la empresa</h2>
                  <p className="text-[10px] text-muted-foreground">Aparecen en facturas, proformas y reportes</p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                {form.companyLogo ? (
                  <img src={form.companyLogo} alt="Logotipo de la empresa" className="h-14 w-14 rounded-lg border border-border object-contain bg-card" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border bg-card text-[10px] text-muted-foreground">
                    Sin logo
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">Identidad visual de la empresa</p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG o SVG. Máximo 2 MB.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted">
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                      {form.companyLogo ? 'Cambiar logotipo' : 'Subir logotipo'}
                    </label>
                    {form.companyLogo ? (
                      <button
                        type="button"
                        onClick={() => setForm((previous) => ({ ...previous, companyLogo: null }))}
                        className="text-[11px] text-destructive hover:underline"
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre comercial</Label>
                  <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Razón social</Label>
                  <Input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>RUC</Label>
                  <Input value={form.rnc} onChange={(event) => setForm({ ...form, rnc: event.target.value })} className="num" />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="num" />
                </div>
                <div className="space-y-1.5">
                  <Label>Correo electrónico</Label>
                  <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección</Label>
                  <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Mensaje al pie de factura</Label>
                  <Textarea value={form.footerMessage} onChange={(event) => setForm({ ...form, footerMessage: event.target.value })} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>IVA (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.taxRate}
                    onChange={(event) => setForm({ ...form, taxRate: toNumber(event.target.value) })}
                    className="num"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Prefijo facturas</Label>
                  <Input value={form.invoicePrefix} onChange={(event) => setForm({ ...form, invoicePrefix: event.target.value.toUpperCase() })} className="num uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prefijo proformas</Label>
                  <Input value={form.proformaPrefix} onChange={(event) => setForm({ ...form, proformaPrefix: event.target.value.toUpperCase() })} className="num uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prefijo compras</Label>
                  <Input value={form.purchasePrefix} onChange={(event) => setForm({ ...form, purchasePrefix: event.target.value.toUpperCase() })} className="num uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prefijo gastos</Label>
                  <Input value={form.expensePrefix} onChange={(event) => setForm({ ...form, expensePrefix: event.target.value.toUpperCase() })} className="num uppercase" />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveSettings}>
                  <Save className="h-4 w-4" /> Guardar configuración
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-info" />
                  <div>
                    <h2 className="font-display text-sm font-semibold">Tasa de cambio</h2>
                    <p className="text-[10px] text-muted-foreground">Conversión NIO ↔ USD en POS</p>
                  </div>
                </div>
                <div className="rounded-lg border border-info/15 bg-info/[0.05] px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-info/80">Tasa vigente</p>
                  <p className="num mt-1 text-2xl font-bold">C$ {formatNumber(settings.exchangeRate, 2)}</p>
                  <p className="text-[10px] text-muted-foreground">por USD 1.00</p>
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label>Nueva tasa (C$ por USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rateInput}
                    onChange={(event) => setRateInput(event.target.value)}
                    className="num"
                  />
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={handleSaveRate}>
                  <Save className="h-4 w-4" /> Actualizar tasa
                </Button>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  Los montos se guardan en córdobas. La tasa solo afecta la visualización y el cobro en dólares.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h2 className="font-display text-sm font-semibold">Reglas operativas</h2>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">Exigir caja abierta</p>
                      <p className="text-[10px] text-muted-foreground">Bloquea efectivo sin sesión</p>
                    </div>
                    <Switch
                      checked={form.cashDrawerRequired}
                      onCheckedChange={(checked) => setForm({ ...form, cashDrawerRequired: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">Alertas de stock bajo</p>
                      <p className="text-[10px] text-muted-foreground">Notifica reposición en dashboard</p>
                    </div>
                    <Switch
                      checked={form.lowStockAlert}
                      onCheckedChange={(checked) => setForm({ ...form, lowStockAlert: checked })}
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={handleSaveSettings}>
                  <Check className="h-3.5 w-3.5" /> Aplicar reglas
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="font-display text-sm font-semibold">Apariencia</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Selecciona el tema de la aplicación</p>
              <div className="mt-3 space-y-2">
                {(['dark', 'light'] as const).map((option) => (
                  <label
                    key={option}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs',
                      themeChoice === option ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/40',
                    )}
                  >
                    <span className="font-medium">{option === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span>
                    <input
                      type="radio"
                      name="theme-choice"
                      checked={themeChoice === option}
                      onChange={() => setThemeChoice(option)}
                    />
                  </label>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={handleApplyTheme}>
                Guardar preferencia
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="font-display text-sm font-semibold">Cuenta y sesión</h2>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario</span>
                  <span className="font-medium">{useSettingsStore.getState().currentUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correo</span>
                  <span className="font-medium">{useSettingsStore.getState().currentUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rol</span>
                  <span className="font-medium capitalize">{useSettingsStore.getState().currentUser.role}</span>
                </div>
              </div>
              <p className="mt-4 text-[10px] text-muted-foreground">
                El cierre de sesión se gestiona desde Configuración.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Usuarios" value={String(users.length)} hint={`${activeUsers} activos`} icon={<Users />} accent="blue" />
            <StatCard label="Administradores" value={String(users.filter((user) => user.role === 'admin').length)} hint="Acceso total al sistema" icon={<ShieldCheck />} accent="blue" />
            <StatCard label="Cajeros" value={String(users.filter((user) => user.role === 'cashier').length)} hint="Operación de POS y caja" icon={<UserCog />} accent="sky" />
            <StatCard label="Supervisores" value={String(users.filter((user) => user.role === 'supervisor').length)} hint="Anulaciones y autorizaciones" icon={<KeyRound />} accent="amber" />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Equipo y permisos</h2>
              <p className="text-[10px] text-muted-foreground">No puedes desactivar tu propio usuario</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const role = roleMeta[user.role];
                  const isSelf = user.id === currentUser.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: user.avatarColor }}
                          >
                            {initials(user.name)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">
                              {user.name} {isSelf ? <span className="text-[10px] text-primary">(tú)</span> : null}
                            </p>
                            <p className="text-[10px] text-muted-foreground">PIN ••••</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={role.variant}>{role.label}</Badge></TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Mail className="h-3 w-3" /> {user.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="num text-[11px]">{formatDate(user.lastLogin)}</p>
                        <p className="num text-[10px] text-muted-foreground">{formatTime(user.lastLogin)}</p>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={user.isActive}
                          disabled={isSelf}
                          onCheckedChange={() => {
                            try {
                              toggleUserActive(user.id);
                              toast.info(
                                user.isActive ? 'Usuario desactivado' : 'Usuario activado',
                                user.name,
                              );
                            } catch (error) {
                              toast.error('Acción no permitida', error instanceof Error ? error.message : undefined);
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Eventos registrados" value={String(logs.length)} hint="Bitácora completa del sistema" icon={<FileClock />} accent="blue" />
            <StatCard label="Eventos de hoy" value={String(auditStats.todayCount)} hint="Actividad de las últimas 24 h" icon={<Activity />} accent="sky" />
            <StatCard label="Advertencias" value={String(auditStats.warning)} hint="Requieren seguimiento" icon={<AlertTriangle />} accent="amber" />
            <StatCard label="Críticos" value={String(auditStats.critical)} hint="Anulaciones, ajustes y bloqueos" icon={<ShieldAlert />} accent="rose" />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
              <SearchInput
                value={auditSearch}
                onChange={setAuditSearch}
                placeholder="Buscar evento o usuario…"
                className="w-full lg:max-w-xs"
              />
              <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as 'all' | AuditSeverity)}>
                <SelectTrigger className="h-9 w-[160px] text-[11px]">
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda severidad</SelectItem>
                  <SelectItem value="info">Informativo</SelectItem>
                  <SelectItem value="warning">Advertencia</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as 'all' | AuditAction)}>
                <SelectTrigger className="h-9 w-[200px] text-[11px]">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {availableActions.map((action) => (
                    <SelectItem key={action} value={action}>{actionLabels[action]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <Search className="h-3.5 w-3.5" /> {filteredLogs.length} eventos
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={<FileClock />}
                title="Sin eventos en este filtro"
                description="Ajusta la severidad o la acción para ver otros registros de auditoría."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 60).map((log) => {
                    const severity = severityMeta[log.severity];
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <p className="num text-[11px]">{formatDate(log.createdAt)}</p>
                          <p className="num text-[10px] text-muted-foreground">{formatTime(log.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.severity === 'critical' ? 'danger' : log.severity === 'warning' ? 'warning' : 'secondary'}>
                            {actionLabels[log.action]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[360px] truncate text-[11px] text-muted-foreground" title={log.description}>{log.description}</p>
                        </TableCell>
                        <TableCell className="text-[11px]">{log.userName}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{log.entity}</TableCell>
                        <TableCell><Badge variant={severity.variant}>{severity.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" onClick={() => setLogDetail(log)} aria-label="Ver evento">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {filteredLogs.length > 60 ? (
              <div className="border-t border-border px-4 py-2 text-center text-[10px] text-muted-foreground">
                Mostrando los 60 eventos más recientes de {filteredLogs.length}. Usa los filtros para acotar la búsqueda.
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(logDetail)} onOpenChange={(open) => { if (!open) setLogDetail(null); }}>
        <DialogContent className="max-w-xl">
          {logDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileClock className="h-4 w-4 text-primary" /> {actionLabels[logDetail.action]}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(logDetail.createdAt)} · {logDetail.userName}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant={severityMeta[logDetail.severity].variant}>{severityMeta[logDetail.severity].label}</Badge>
                <Badge variant="outline">{logDetail.entity}</Badge>
                <Badge variant="secondary">ID {logDetail.entityId}</Badge>
              </div>
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">{logDetail.description}</p>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Metadatos</p>
                {Object.entries(logDetail.metadata).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Sin metadatos adicionales.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(logDetail.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-4 text-[11px]">
                        <span className="capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                        <span className={cn('num text-right font-medium', typeof value === 'number' && key.match(/monto|total|saldo|limite|nuevo|anterior/i) ? 'text-info' : '')}>
                          {typeof value === 'number' ? formatNumber(value, 2) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
