import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  FileClock,
  Filter,
  Mail,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AuditAction,
  AuditLog,
  AuditSeverity,
  Customer,
  Supplier,
  User,
  UserRole,
} from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuditStore } from '@/store/useAuditStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  CreditDrawer,
  UserDrawer,
  VendorDrawer,
} from '@/modules/Admin/AdminDrawers';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyStat,
  formatNumber,
  formatTime,
  initials,
  timeAgo,
} from '@/utils/format';
import { cn } from '@/lib/utils';
import LegacyAdminSettings from '@/modules/admin/AdminPage';

type AdminTab = 'team' | 'crm' | 'audit' | 'settings';
type TeamFilter = 'all' | 'staff' | 'vendor' | 'inactive';
type CrmFilter = 'all' | 'authorized' | 'blocked';
type AuditRange = 'all' | 'today' | '7d' | '30d';

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
  warehouse: 'Bodega',
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

const severityMeta: Record<AuditSeverity, { label: string; variant: 'secondary' | 'warning' | 'danger' }> = {
  info: { label: 'Información', variant: 'secondary' },
  warning: { label: 'Advertencia', variant: 'warning' },
  critical: { label: 'Crítico', variant: 'danger' },
};

interface TeamRow {
  key: string;
  kind: 'staff' | 'vendor';
  name: string;
  subtitle: string;
  meta: string;
  isActive: boolean;
  activity: string;
  user?: User;
  supplier?: Supplier;
}

function isAuthorized(customer: Customer): boolean {
  return customer.creditAuthorized ?? customer.creditLimit > 0;
}

function creditDays(customer: Customer): number {
  return customer.creditDays ?? 30;
}

function withinRange(iso: string, range: AuditRange): boolean {
  if (range === 'all') return true;
  const date = new Date(iso).getTime();
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return date >= start.getTime();
  }
  const start = new Date(now);
  start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
  return date >= start.getTime();
}

export default function AdminModule(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const users = useSettingsStore((state) => state.users);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const toggleUserActive = useSettingsStore((state) => state.toggleUserActive);
  const customers = useCatalogStore((state) => state.customers);
  const suppliers = useCatalogStore((state) => state.suppliers);
  const toggleSupplierActive = useCatalogStore((state) => state.toggleSupplierActive);
  const logs = useAuditStore((state) => state.logs);
  const addLog = useAuditStore((state) => state.addLog);

  const [tab, setTab] = useState<AdminTab>(() => {
    const param = searchParams.get('tab');
    if (param === 'auditoria' || param === 'audit') return 'audit';
    if (param === 'config' || param === 'settings') return 'settings';
    return 'team';
  });
  const [teamSearch, setTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilter, setCrmFilter] = useState<CrmFilter>('all');
  const [userDrawer, setUserDrawer] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [vendorDrawer, setVendorDrawer] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntity, setAuditEntity] = useState('all');
  const [auditUser, setAuditUser] = useState('all');
  const [auditSeverity, setAuditSeverity] = useState('all');
  const [auditRange, setAuditRange] = useState<AuditRange>('30d');
  const [auditDetail, setAuditDetail] = useState<AuditLog | null>(null);

  const teamRows = useMemo<TeamRow[]>(
    () => [
      ...users.map((user) => ({
        key: `user-${user.id}`,
        kind: 'staff' as const,
        name: user.name,
        subtitle: user.email,
        meta: roleLabels[user.role],
        isActive: user.isActive,
        activity: timeAgo(user.lastLogin),
        user,
      })),
      ...suppliers.map((supplier) => ({
        key: `supplier-${supplier.id}`,
        kind: 'vendor' as const,
        name: supplier.name,
        subtitle: supplier.contactName
          ? `${supplier.contactName}${supplier.phone ? ` · ${supplier.phone}` : ''}`
          : supplier.phone || 'Sin contacto',
        meta: supplier.category,
        isActive: supplier.isActive,
        activity: `Desde ${formatDate(supplier.createdAt)}`,
        supplier,
      })),
    ],
    [users, suppliers],
  );

  const filteredTeam = useMemo(() => {
    const term = teamSearch.trim().toLowerCase();
    return teamRows.filter((row) => {
      if (teamFilter === 'staff' && row.kind !== 'staff') return false;
      if (teamFilter === 'vendor' && row.kind !== 'vendor') return false;
      if (teamFilter === 'inactive' && row.isActive) return false;
      if (!term) return true;
      return `${row.name} ${row.subtitle} ${row.meta} ${row.activity}`
        .toLowerCase()
        .includes(term);
    });
  }, [teamRows, teamFilter, teamSearch]);

  const filteredCustomers = useMemo(() => {
    const term = crmSearch.trim().toLowerCase();
    return customers
      .filter((customer) => {
        const authorized = isAuthorized(customer);
        const blocked = !authorized || customer.balance >= customer.creditLimit;
        if (crmFilter === 'authorized' && !authorized) return false;
        if (crmFilter === 'blocked' && !blocked) return false;
        if (!term) return true;
        return `${customer.name} ${customer.businessName} ${customer.phone} ${customer.taxId}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => b.balance - a.balance);
  }, [customers, crmFilter, crmSearch]);

  const auditEntities = useMemo(
    () => Array.from(new Set(logs.map((log) => log.entity))).sort(),
    [logs],
  );
  const auditUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((log) => map.set(log.userId, log.userName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return logs
      .filter((log) => {
        if (auditEntity !== 'all' && log.entity !== auditEntity) return false;
        if (auditUser !== 'all' && log.userId !== auditUser) return false;
        if (auditSeverity !== 'all' && log.severity !== auditSeverity) return false;
        if (!withinRange(log.createdAt, auditRange)) return false;
        if (!term) return true;
        return `${log.description} ${log.userName} ${log.userId} ${log.entity} ${log.entityId} ${actionLabels[log.action]}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs, auditSearch, auditEntity, auditUser, auditSeverity, auditRange]);

  const authorizedCustomers = customers.filter(isAuthorized);
  const creditPortfolio = customers.reduce((acc, customer) => acc + customer.balance, 0);
  const activeStaff = users.filter((user) => user.isActive).length;
  const activeVendors = suppliers.filter((supplier) => supplier.isActive).length;
  const criticalLogs = logs.filter((log) => log.severity === 'critical').length;

  const handleToggleUser = (user: User): void => {
    try {
      toggleUserActive(user.id);
      toast.info(
        user.isActive ? 'Colaborador desactivado' : 'Colaborador activado',
        user.name,
      );
    } catch (error) {
      toast.error('No se pudo cambiar el estado', error instanceof Error ? error.message : undefined);
    }
  };

  const handleToggleVendor = (supplier: Supplier): void => {
    toggleSupplierActive(supplier.id);
    addLog({
      action: 'supplier_updated',
      entity: 'Proveedor',
      entityId: supplier.id,
      description: `${supplier.name} ${supplier.isActive ? 'desactivado' : 'activado'} desde administración.`,
      severity: 'warning',
      userId: currentUser.id,
      userName: currentUser.name,
      metadata: { activo: !supplier.isActive },
    });
    toast.info(
      supplier.isActive ? 'Proveedor desactivado' : 'Proveedor activado',
      supplier.name,
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración"
        title="Colaboradores y control de acceso"
        description="Gestiona colaboradores, roles y auditoría del sistema."
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <Badge variant="secondary" className="h-8 px-3">
            <BadgeCheck className="h-3.5 w-3.5" /> Sesión: {currentUser.name}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Equipo activo"
          value={String(activeStaff)}
          hint={`${users.length} colaboradores registrados`}
          icon={<Users />}
          accent="blue"
        />
        <StatCard
          label="Proveedores activos"
          value={String(activeVendors)}
          hint={`${suppliers.length} vendors en catálogo`}
          icon={<Building2 />}
          accent="sky"
        />
        <StatCard
          label="Crédito autorizado"
          value={String(authorizedCustomers.length)}
          hint={`Cartera ${formatMoneyStat(creditPortfolio)}`}
          icon={<CreditCard />}
          accent="amber"
        />
        <StatCard
          label="Eventos críticos"
          value={String(criticalLogs)}
          hint={`${logs.length} eventos en bitácora`}
          icon={<ShieldAlert />}
          accent="rose"
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)}>
        <TabsList>
          <TabsTrigger value="settings"><Building2 /> Configuración</TabsTrigger>
          <TabsTrigger value="team">
            <Users /> Equipo & proveedores
          </TabsTrigger>
          <TabsTrigger value="crm">
            <CreditCard /> CRM clientes
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileClock /> Auditoría
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings"><LegacyAdminSettings /></TabsContent>

        <TabsContent value="team" className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5 xl:flex-row xl:items-center">
              <SearchInput
                value={teamSearch}
                onChange={setTeamSearch}
                placeholder="Buscar por nombre, contacto, rol o categoría…"
                className="w-full xl:max-w-xs"
              />
              <Select value={teamFilter} onValueChange={(value) => setTeamFilter(value as TeamFilter)}>
                <SelectTrigger className="h-9 w-[190px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el equipo</SelectItem>
                  <SelectItem value="staff">Solo colaboradores</SelectItem>
                  <SelectItem value="vendor">Solo proveedores</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <span className="mr-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Search className="h-3 w-3" /> {filteredTeam.length} registros
                </span>
                <Button variant="outline" size="sm" onClick={() => setVendorDrawer({ open: true, id: null })}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo proveedor
                </Button>
                <Button size="sm" onClick={() => setUserDrawer({ open: true, id: null })}>
                  <UserCog className="h-3.5 w-3.5" /> Nuevo colaborador
                </Button>
              </div>
            </div>

            {filteredTeam.length === 0 ? (
              <EmptyState
                icon={<Users />}
                title="Sin registros en este filtro"
                description="Ajusta la búsqueda o agrega un colaborador o proveedor nuevo."
              />
            ) : (
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Rol / categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeam.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          {row.kind === 'staff' && row.user ? (
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white/90"
                              style={{ backgroundColor: row.user.avatarColor }}
                            >
                              {initials(row.user.name)}
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info">
                              <Building2 className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{row.name}</p>
                            <p className="truncate text-[9px] text-muted-foreground">{row.subtitle}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={row.kind === 'staff' ? 'default' : 'secondary'}>
                          {row.kind === 'staff' ? (
                            <><Users /> Colaborador</>
                          ) : (
                            <><Building2 /> Proveedor</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {row.kind === 'staff' ? row.subtitle : row.supplier?.email || 'Sin correo'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="secondary">{row.meta}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={row.isActive ? 'success' : 'danger'}>
                          {row.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Clock3 className="h-3 w-3" /> {row.activity}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              if (row.kind === 'staff' && row.user) {
                                setUserDrawer({ open: true, id: row.user.id });
                              } else if (row.supplier) {
                                setVendorDrawer({ open: true, id: row.supplier.id });
                              }
                            }}
                            aria-label={`Editar ${row.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={row.kind === 'staff' && row.user?.id === currentUser.id}
                            onClick={() => {
                              if (row.kind === 'staff' && row.user) handleToggleUser(row.user);
                              if (row.kind === 'vendor' && row.supplier) handleToggleVendor(row.supplier);
                            }}
                            aria-label={row.isActive ? `Desactivar ${row.name}` : `Activar ${row.name}`}
                          >
                            <Power className={cn('h-3.5 w-3.5', row.isActive ? 'text-success' : 'text-destructive')} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="crm" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cartera de clientes</p>
              <p className="num mt-1 font-display text-xl font-bold text-warning">{formatMoney(creditPortfolio)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Con crédito autorizado</p>
              <p className="num mt-1 font-display text-xl font-bold text-success">{authorizedCustomers.length} clientes</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Límite bloqueado / agotado</p>
              <p className="num mt-1 font-display text-xl font-bold text-destructive">
                {customers.filter((customer) => !isAuthorized(customer) || customer.balance >= customer.creditLimit).length}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
              <SearchInput
                value={crmSearch}
                onChange={setCrmSearch}
                placeholder="Buscar cliente, negocio, RUC o teléfono…"
                className="w-full lg:max-w-xs"
              />
              <Select value={crmFilter} onValueChange={(value) => setCrmFilter(value as CrmFilter)}>
                <SelectTrigger className="h-9 w-[190px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  <SelectItem value="authorized">Crédito autorizado</SelectItem>
                  <SelectItem value="blocked">Bloqueados / contado</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" /> {filteredCustomers.length} clientes
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <EmptyState
                icon={<CreditCard />}
                title="Sin clientes en este filtro"
                description="Cambia el filtro o busca otro cliente para ajustar su línea de crédito."
              />
            ) : (
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead className="text-right">Días</TableHead>
                    <TableHead className="text-right">Límite máximo</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const authorized = isAuthorized(customer);
                    const limit = authorized ? customer.creditLimit : 0;
                    const available = Math.max(0, limit - customer.balance);
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">
                              {initials(customer.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{customer.name}</p>
                              <p className="truncate text-[9px] text-muted-foreground">{customer.businessName || 'Persona natural'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="num text-[10px]">{customer.phone || 'Sin teléfono'}</p>
                          <p className="num text-[9px] text-muted-foreground">{customer.taxId || 'Sin RUC'}</p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant={authorized ? 'success' : 'secondary'}>
                            {authorized ? <CheckCircle2 /> : <ShieldAlert />}
                            {authorized ? 'Autorizado' : 'Solo contado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px]">
                          {authorized ? `${creditDays(customer)} días` : '—'}
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-[11px]">
                          {formatMoney(limit)}
                        </TableCell>
                        <TableCell className={cn('num py-2.5 text-right text-[11px] font-semibold', customer.balance > 0 ? 'text-warning' : 'text-muted-foreground')}>
                          {formatMoney(customer.balance)}
                        </TableCell>
                        <TableCell className={cn('num py-2.5 text-right text-[11px] font-semibold', available > 0 ? 'text-success' : 'text-destructive')}>
                          {formatMoney(available)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Button variant="outline" size="sm" onClick={() => setCreditCustomer(customer)}>
                            <Pencil className="h-3 w-3" /> Editar crédito
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2.5 border-b border-border p-3.5 xl:flex-row xl:items-center">
              <SearchInput
                value={auditSearch}
                onChange={setAuditSearch}
                placeholder="Buscar acción, descripción, usuario o ID…"
                className="w-full xl:max-w-xs"
              />
              <Select value={auditEntity} onValueChange={setAuditEntity}>
                <SelectTrigger className="h-9 w-[165px] text-[11px]">
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los módulos</SelectItem>
                  {auditEntities.map((entity) => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={auditUser} onValueChange={setAuditUser}>
                <SelectTrigger className="h-9 w-[175px] text-[11px]">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {auditUsers.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name} · {id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={auditSeverity} onValueChange={setAuditSeverity}>
                <SelectTrigger className="h-9 w-[145px] text-[11px]">
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda severidad</SelectItem>
                  <SelectItem value="info">Información</SelectItem>
                  <SelectItem value="warning">Advertencia</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditRange} onValueChange={(value) => setAuditRange(value as AuditRange)}>
                <SelectTrigger className="h-9 w-[150px] text-[11px]">
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                  <SelectItem value="all">Todo el histórico</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> {filteredLogs.length} eventos
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={<FileClock />}
                title="Sin eventos en este filtro"
                description="Ajusta el rango de fecha, el módulo, el usuario o la severidad."
              />
            ) : (
              <Table className="min-w-[1050px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha / hora</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 80).map((log) => {
                    const severity = severityMeta[log.severity];
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="py-2.5">
                          <p className="num text-[10px]">{formatDate(log.createdAt)}</p>
                          <p className="num text-[9px] text-muted-foreground">{formatTime(log.createdAt)}</p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline">{log.entity}</Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-[10px] font-medium">{actionLabels[log.action]}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="max-w-[360px] truncate text-[10px] text-muted-foreground" title={log.description}>
                            {log.description}
                          </p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="text-[10px] font-medium">{log.userName}</p>
                          <p className="num text-[9px] text-muted-foreground">{log.userId}</p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant={severity.variant}>{severity.label}</Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Button variant="ghost" size="icon-sm" onClick={() => setAuditDetail(log)} aria-label="Ver evento">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {filteredLogs.length > 80 ? (
              <div className="border-t border-border px-4 py-2 text-center text-[10px] text-muted-foreground">
                Mostrando los 80 eventos más recientes de {filteredLogs.length}. Acota la búsqueda para ver otros registros.
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <UserDrawer
        open={userDrawer.open}
        userId={userDrawer.id}
        onClose={() => setUserDrawer({ open: false, id: null })}
      />
      <VendorDrawer
        open={vendorDrawer.open}
        supplierId={vendorDrawer.id}
        onClose={() => setVendorDrawer({ open: false, id: null })}
      />
      <CreditDrawer
        open={Boolean(creditCustomer)}
        customer={creditCustomer}
        onClose={() => setCreditCustomer(null)}
      />

      <Dialog open={Boolean(auditDetail)} onOpenChange={(value) => { if (!value) setAuditDetail(null); }}>
        <DialogContent className="max-w-xl">
          {auditDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileClock className="h-4 w-4 text-primary" /> {actionLabels[auditDetail.action]}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(auditDetail.createdAt)} · {auditDetail.userName} ({auditDetail.userId})
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant={severityMeta[auditDetail.severity].variant}>
                  {severityMeta[auditDetail.severity].label}
                </Badge>
                <Badge variant="outline">{auditDetail.entity}</Badge>
                <Badge variant="secondary">ID {auditDetail.entityId}</Badge>
              </div>
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
                {auditDetail.description}
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3 w-3" /> Metadatos
                </p>
                {Object.entries(auditDetail.metadata).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Sin metadatos adicionales.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(auditDetail.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-4 text-[11px]">
                        <span className="capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                        <span className="num text-right font-medium">
                          {typeof value === 'number'
                            ? formatNumber(value, Number.isInteger(value) ? 0 : 2)
                            : typeof value === 'boolean'
                              ? value
                                ? 'Sí'
                                : 'No'
                              : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(auditDetail.createdAt)} a las {formatTime(auditDetail.createdAt)}
                <ChevronRight className="ml-auto h-3 w-3" />
                {actionLabels[auditDetail.action]}
                <Wallet className="ml-2 h-3 w-3" />
                {auditDetail.entity}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
