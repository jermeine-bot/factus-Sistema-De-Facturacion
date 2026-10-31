import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Eye,
  Factory,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { Supplier } from '@/types';
import { useCatalogStore, type SupplierDraft } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

type TypeFilter = 'all' | 'purchase' | 'expense';

const emptyDraft: SupplierDraft = {
  name: '',
  type: 'purchase',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  category: '',
  isActive: true,
};

export default function SuppliersPage(): React.JSX.Element {
  const suppliers = useCatalogStore((state) => state.suppliers);
  const createSupplier = useCatalogStore((state) => state.createSupplier);
  const updateSupplier = useCatalogStore((state) => state.updateSupplier);
  const toggleSupplierActive = useCatalogStore((state) => state.toggleSupplierActive);
  const settings = useSettingsStore((state) => state.settings);

  const rate = settings.exchangeRate;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const purchase = suppliers.filter((supplier) => supplier.type === 'purchase');
    const expense = suppliers.filter((supplier) => supplier.type === 'expense');
    return {
      purchase: purchase.length,
      expense: expense.length,
      active: suppliers.filter((supplier) => supplier.isActive).length,
      payable: suppliers.reduce((acc, supplier) => acc + supplier.balance, 0),
    };
  }, [suppliers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers
      .filter((supplier) => {
        if (!showInactive && !supplier.isActive) return false;
        if (typeFilter !== 'all' && supplier.type !== typeFilter) return false;
        if (term && !`${supplier.name} ${supplier.contactName} ${supplier.category} ${supplier.phone} ${supplier.email}`.toLowerCase().includes(term)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.balance - a.balance);
  }, [suppliers, search, typeFilter, showInactive]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const detail = suppliers.find((supplier) => supplier.id === detailId) ?? null;

  const openCreate = (): void => {
    setEditing(null);
    setDraft({ ...emptyDraft });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (supplier: Supplier): void => {
    setEditing(supplier);
    setDraft({
      name: supplier.name,
      type: supplier.type,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      category: supplier.category,
      isActive: supplier.isActive,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (): void => {
    setFormError('');
    try {
      if (!draft.name.trim()) throw new Error('El nombre del proveedor es obligatorio.');
      if (!draft.category.trim()) throw new Error('Indica la categoría o giro del proveedor.');
      const payload: SupplierDraft = {
        ...draft,
        name: draft.name.trim(),
        contactName: draft.contactName.trim(),
        category: draft.category.trim(),
      };
      if (editing) {
        updateSupplier(editing.id, payload);
        toast.success('Proveedor actualizado', payload.name);
      } else {
        createSupplier(payload);
        toast.success('Proveedor creado', payload.name);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el proveedor.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catálogo"
        title="Proveedores"
        description="Separa proveedores de inventario y proveedores de gasto. Compras y gastos rechazan un tipo incorrecto."
        icon={<Factory className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Nuevo proveedor
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Proveedores de compra" value={String(stats.purchase)} hint="Surtido de inventario" icon={<Truck />} accent="blue" />
        <StatCard label="Proveedores de gasto" value={String(stats.expense)} hint="Servicios y operación" icon={<Building2 />} accent="sky" />
        <StatCard label="Cuentas por pagar" value={formatMoney(stats.payable, rate)} hint="Saldo acumulado a crédito" icon={<ShieldCheck />} accent="amber" />
        <StatCard label="Proveedores activos" value={String(stats.active)} hint={`${suppliers.length} registrados en total`} icon={<Factory />} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Buscar proveedor, contacto o giro…"
            className="w-full lg:max-w-xs"
          />
          <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value as TypeFilter); setPage(1); }}>
            <SelectTrigger className="h-9 w-[190px] text-[11px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="purchase">Proveedor de inventario</SelectItem>
              <SelectItem value="expense">Proveedor de gasto</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-[11px] text-muted-foreground">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Ver inactivos
          </label>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> {filtered.length} proveedores
          </div>
        </div>

        {paginated.length === 0 ? (
          <EmptyState
            icon={<Factory />}
            title="Sin proveedores en este filtro"
            description="Registra proveedores de inventario y de gasto para clasificar correctamente las operaciones."
            action={<Button size="sm" onClick={openCreate}><Plus /> Nuevo proveedor</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Giro</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                          supplier.type === 'purchase'
                            ? 'border-primary/20 bg-primary/10 text-primary'
                            : 'border-destructive/20 bg-destructive/10 text-destructive',
                        )}
                      >
                        {supplier.type === 'purchase' ? <Truck className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{supplier.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">Desde {formatDate(supplier.createdAt)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier.type === 'purchase' ? (
                      <Badge variant="default">Inventario</Badge>
                    ) : (
                      <Badge variant="secondary">Gasto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{supplier.contactName || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{supplier.category}</TableCell>
                  <TableCell className="num text-[11px] text-muted-foreground">{supplier.phone || '—'}</TableCell>
                  <TableCell className={cn('num text-right text-xs font-semibold', supplier.balance > 0 ? 'text-warning' : 'text-muted-foreground')}>
                    {formatMoney(supplier.balance, rate)}
                  </TableCell>
                  <TableCell>
                    {supplier.isActive ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDetailId(supplier.id)} aria-label="Ver proveedor">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(supplier)} aria-label="Editar proveedor">
                        <PenLine className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          toggleSupplierActive(supplier.id);
                          toast.info(supplier.isActive ? 'Proveedor desactivado' : 'Proveedor activado', supplier.name);
                        }}
                        aria-label={supplier.isActive ? 'Desactivar proveedor' : 'Activar proveedor'}
                        className={supplier.isActive ? 'text-destructive/70 hover:text-destructive' : 'text-success/70 hover:text-success'}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <PenLine className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              {editing ? 'Editar proveedor' : 'Nuevo proveedor'}
            </DialogTitle>
            <DialogDescription>
              El tipo define dónde puede usarse: inventario en Compras, gasto en Gastos operativos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre del proveedor</Label>
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Distribuidora La Universal" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de proveedor</Label>
              <Select value={draft.type} onValueChange={(value) => setDraft({ ...draft, type: value as Supplier['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Proveedor de inventario</SelectItem>
                  <SelectItem value="expense">Proveedor de gasto</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {draft.type === 'purchase' ? 'Se usa en compras de productos y suma stock.' : 'Se usa en gastos operativos y servicios.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Giro / categoría</Label>
              <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Abarrotes y bebidas" />
            </div>
            <div className="space-y-1.5">
              <Label>Persona de contacto</Label>
              <Input value={draft.contactName} onChange={(event) => setDraft({ ...draft, contactName: event.target.value })} placeholder="Luis Fonseca" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+505 2255 1010" className="num" />
            </div>
            <div className="space-y-1.5">
              <Label>Correo electrónico</Label>
              <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="ventas@proveedor.com.ni" />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} placeholder="Zona Industrial, Managua" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 sm:col-span-2">
              <div>
                <p className="text-xs font-medium">Proveedor activo</p>
                <p className="text-[10px] text-muted-foreground">Los inactivos no aparecen en compras ni gastos</p>
              </div>
              <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
            </div>
          </div>

          {editing ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              Saldo actual con el proveedor: <span className="num font-semibold text-warning">{formatMoney(editing.balance, rate)}</span>
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{formError}</div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4" /> {editing ? 'Guardar cambios' : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.type === 'purchase' ? <Truck className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-destructive" />}
                  {detail.name}
                </DialogTitle>
                <DialogDescription>{detail.category} · {detail.type === 'purchase' ? 'Proveedor de inventario' : 'Proveedor de gasto'}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3.5 text-xs">
                <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span>{detail.contactName || 'Sin contacto'}</span></div>
                <div className="flex items-start gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span className="num">{detail.phone || 'Sin teléfono'}</span></div>
                <div className="flex items-start gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span>{detail.email || 'Sin correo'}</span></div>
                <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span>{detail.address || 'Sin dirección'}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo pendiente</p>
                  <p className="num mt-1 text-lg font-bold text-warning">{formatMoney(detail.balance, rate)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estado</p>
                  <p className="mt-1">{detail.isActive ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDetailId(null); openEdit(detail); }}>
                  <PenLine className="h-4 w-4" /> Editar
                </Button>
                <Button onClick={() => setDetailId(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
