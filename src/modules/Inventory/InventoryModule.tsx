import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  Download,
  Eye,
  FileSpreadsheet,
  Hash,
  History,
  Layers,
  Lock,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { Product, ProductType } from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useAuditStore } from '@/store/useAuditStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { StatCard } from '@/components/shared/stat-card';
import { ProductTypeBadge } from '@/components/shared/product-type-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductDrawer } from '@/modules/Inventory/ProductDrawer';
import { AdjustStockModal } from '@/modules/Inventory/AdjustStockModal';
import { KardexPanel } from '@/modules/Inventory/KardexPanel';
import { isLotTracked, isSerialTracked } from '@/modules/Inventory/inventoryData';
import {
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyStat,
  formatNumber,
  stockStatus,
} from '@/utils/format';
import { getAvailability, PRODUCT_TYPE_META } from '@/utils/product';
import { margin } from '@/utils/math';
import { cn } from '@/lib/utils';

type CatalogTab = 'catalog' | 'kardex' | 'audit';
type StockFilter = 'all' | 'active' | 'low' | 'out' | 'inactive';
type SortMode = 'name' | 'stock-asc' | 'value-desc' | 'updated';

const PAGE_SIZE = 12;

const typeIcons: Record<ProductType, typeof Package> = {
  common: Package,
  grouped: Scale,
  integrated: Boxes,
  floating: Sparkles,
};

function inventoryStatus(product: Product, catalog: Product[]): 'service' | 'out' | 'low' | 'ok' {
  if (product.type === 'floating') return 'service';
  if (product.type === 'integrated') {
    const availability = getAvailability(product, catalog);
    return availability <= 0 ? 'out' : availability <= 1 ? 'low' : 'ok';
  }
  return stockStatus(product.stock, product.minStock);
}

export default function InventoryModule(): React.JSX.Element {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const toggleProductActive = useCatalogStore((state) => state.toggleProductActive);
  const adjustments = useInventoryStore((state) => state.adjustments);
  const addLog = useAuditStore((state) => state.addLog);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const [tab, setTab] = useState<CatalogTab>('catalog');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ProductType>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sort, setSort] = useState<SortMode>('name');
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [kardexProductId, setKardexProductId] = useState<string | null>(null);

  useEffect(() => {
    const requested = searchParams.get('tab');
    if (requested === 'stock') setTab('catalog');
    else if (requested === 'movimientos') {
      setTab('kardex');
      if (!kardexProductId) {
        const first = products.find((product) => product.type === 'common' || product.type === 'grouped');
        if (first) setKardexProductId(first.id);
      }
    } else if (requested === 'audit') setTab('audit');
  }, [searchParams, products, kardexProductId]);

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => product.isActive);
    const stockValue = products.reduce(
      (acc, product) =>
        acc + (product.type === 'floating' || product.type === 'integrated' ? 0 : product.stock * product.cost),
      0,
    );
    const critical = products.filter(
      (product) =>
        product.isActive &&
        (product.type === 'common' || product.type === 'grouped') &&
        stockStatus(product.stock, product.minStock) !== 'ok',
    ).length;
    return {
      active: activeProducts.length,
      stockValue,
      critical,
      grouped: activeProducts.filter((product) => product.type === 'grouped').length,
      combos: activeProducts.filter((product) => product.type === 'integrated').length,
      lots: activeProducts.filter(isLotTracked).length,
      serials: activeProducts.filter(isSerialTracked).length,
    };
  }, [products]);

  const typeCounts = useMemo(() => {
    const counts: Record<ProductType, number> = { common: 0, floating: 0, integrated: 0, grouped: 0 };
    for (const product of products) counts[product.type] += 1;
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = products.filter((product) => {
      if (
        term &&
        !`${product.name} ${product.sku} ${product.category} ${product.barcode ?? ''}`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      if (category !== 'all' && product.category !== category) return false;
      if (typeFilter !== 'all' && product.type !== typeFilter) return false;

      const status = inventoryStatus(product, products);
      if (stockFilter === 'active' && !product.isActive) return false;
      if (stockFilter === 'inactive' && product.isActive) return false;
      if (stockFilter === 'low' && (status === 'ok' || status === 'service')) return false;
      if (stockFilter === 'out' && status !== 'out') return false;
      return true;
    });

    if (sort === 'name') return [...result].sort((left, right) => left.name.localeCompare(right.name));
    if (sort === 'stock-asc') {
      return [...result].sort(
        (left, right) => getAvailability(left, products) - getAvailability(right, products),
      );
    }
    if (sort === 'value-desc') {
      return [...result].sort(
        (left, right) => right.stock * right.cost - left.stock * left.cost,
      );
    }
    return [...result].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }, [products, search, category, typeFilter, stockFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, category, typeFilter, stockFilter, sort]);

  const openCreate = (): void => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const openEdit = (product: Product): void => {
    setEditingProduct(product);
    setDrawerOpen(true);
  };

  const openAdjust = (product: Product): void => {
    setAdjustingProduct(product);
  };

  const openKardex = (product: Product): void => {
    if (product.type === 'floating' || product.type === 'integrated') {
      toast.info('Sin Kardex físico', 'Los servicios y combos no manejan stock propio.');
      return;
    }
    setKardexProductId(product.id);
    setTab('kardex');
  };

  const handleToggle = (product: Product): void => {
    try {
      toggleProductActive(product.id);
      addLog({
        action: 'product_updated',
        entity: 'Producto',
        entityId: product.id,
        description: `${product.name} ${product.isActive ? 'desactivado' : 'activado'} en el catálogo.`,
        severity: 'warning',
        userId: currentUser.id,
        userName: currentUser.name,
      });
      toast.success(
        product.isActive ? 'Producto desactivado' : 'Producto activado',
        `${product.name} · ${product.sku}`,
      );
    } catch (toggleError) {
      toast.error('No se pudo actualizar', toggleError instanceof Error ? toggleError.message : undefined);
    }
  };

  const handleExport = (): void => {
    const rows: Array<Array<string | number>> = [
      [
        'SKU',
        'Producto',
        'Tipo',
        'Categoría',
        'Código de barras',
        'Stock',
        'Unidad',
        'Costo C$',
        'Precio C$',
        'Margen %',
        'Lote',
        'Serial',
        'Estado',
        'Actualizado',
      ],
      ...filtered.map((product) => [
        product.sku,
        product.name,
        PRODUCT_TYPE_META[product.type].short,
        product.category,
        product.barcode ?? '',
        product.stock,
        product.unit,
        product.cost,
        product.price,
        margin(product.cost, product.price),
        isLotTracked(product) ? 'Sí' : 'No',
        isSerialTracked(product) ? 'Sí' : 'No',
        product.isActive ? 'Activo' : 'Inactivo',
        formatDate(product.updatedAt),
      ]),
    ];
    downloadCsv(`inventario-factus-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Catálogo exportado', `${filtered.length} productos en CSV.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catálogo maestro · trazabilidad"
        title="Inventario & productos"
        description="Controla existencias, conversiones multi-unidad, combos y cada movimiento de stock con lotes, seriales y auditoría."
        icon={<Package className="h-5 w-5" />}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Badge variant="warning" className="hidden h-8 gap-1.5 px-2.5 sm:inline-flex">
              <Lock /> Stock físico bloqueado
            </Badge>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" /> Nuevo producto
              </Button>
            </div>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Productos activos"
          value={String(stats.active)}
          hint={`${stats.grouped} agrupados · ${stats.combos} combos`}
          icon={<Layers />}
          accent="blue"
        />
        <StatCard
          label="Valor de inventario"
          value={formatMoneyStat(stats.stockValue, rate)}
          hint="Al costo, sin servicios ni combos"
          icon={<Boxes />}
          accent="sky"
        />
        <StatCard
          label="Stock crítico"
          value={String(stats.critical)}
          hint="Productos en o bajo el mínimo"
          icon={<AlertTriangle />}
          accent="amber"
        />
        <StatCard
          label="Ajustes auditados"
          value={String(adjustments.length)}
          hint={`${stats.lots} con lote · ${stats.serials} serializados`}
          icon={<ShieldCheck />}
          accent="blue"
        />
      </div>

      {stats.critical > 0 ? (
        <button
          type="button"
          onClick={() => {
            setTab('catalog');
            setStockFilter('low');
          }}
          className="flex w-full items-center gap-2.5 rounded-lg border border-warning/15 bg-warning/[0.05] px-3.5 py-2.5 text-left transition-colors hover:bg-warning/[0.08]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="flex-1 text-[11px] text-warning/90">
            <span className="font-semibold">{stats.critical} productos</span> requieren reposición o revisión
            de existencias. Usa los filtros de stock para priorizar.
          </p>
          <span className="text-[10px] font-medium text-warning">Filtrar</span>
        </button>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as CatalogTab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="catalog">
              <Package /> Catálogo
              <span className="num text-[9px] text-muted-foreground">{products.length}</span>
            </TabsTrigger>
            <TabsTrigger value="kardex">
              <History /> Kardex & trazabilidad
            </TabsTrigger>
            <TabsTrigger value="audit">
              <SlidersHorizontal /> Ajustes
              <span className="num text-[9px] text-muted-foreground">{adjustments.length}</span>
            </TabsTrigger>
          </TabsList>
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" />
            Política activa: <span className="text-warning">stock solo por ajuste absoluto auditado</span>
          </p>
        </div>

        <TabsContent value="catalog">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="space-y-2.5 border-b border-border p-3.5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por nombre, SKU, código de barras o categoría…"
                  className="w-full lg:max-w-sm"
                  ariaLabel="Buscar productos"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9 w-[175px] text-[11px]">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {categories.map((entry) => (
                        <SelectItem key={entry.id} value={entry.name}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as StockFilter)}>
                    <SelectTrigger className="h-9 w-[135px] text-[11px]">
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el stock</SelectItem>
                      <SelectItem value="active">Solo activos</SelectItem>
                      <SelectItem value="low">Stock bajo</SelectItem>
                      <SelectItem value="out">Agotados</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}>
                    <SelectTrigger className="h-9 w-[142px] text-[11px]">
                      <ArrowUpDown className="mr-1 h-3 w-3 text-muted-foreground" />
                      <SelectValue placeholder="Orden" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nombre A-Z</SelectItem>
                      <SelectItem value="stock-asc">Menor existencia</SelectItem>
                      <SelectItem value="value-desc">Mayor valor</SelectItem>
                      <SelectItem value="updated">Actualizados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="ml-auto hidden text-[10px] text-muted-foreground xl:block">
                  {filtered.length} resultados
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tipo
                </span>
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors',
                    typeFilter === 'all'
                      ? 'border-border bg-muted/40 text-foreground'
                      : 'border-border text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  Todos <span className="num opacity-60">{products.length}</span>
                </button>
                {(Object.keys(PRODUCT_TYPE_META) as ProductType[]).map((entry) => {
                  const meta = PRODUCT_TYPE_META[entry];
                  const active = typeFilter === entry;
                  return (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setTypeFilter(active ? 'all' : entry)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all',
                        meta.tone,
                        active ? 'ring-1 ring-current/40' : 'opacity-65 hover:opacity-100',
                      )}
                    >
                      {meta.short} <span className="num opacity-60">{typeCounts[entry]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paginated.length === 0 ? (
              <EmptyState
                icon={<FileSpreadsheet />}
                title="Sin productos con estos filtros"
                description="Ajusta la búsqueda, cambia el tipo o crea un nuevo producto para comenzar."
                action={
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" /> Nuevo producto
                  </Button>
                }
              />
            ) : (
              <Table className="min-w-[930px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Existencia</TableHead>
                    <TableHead className="text-right">Costo / Precio</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((product) => {
                    const Icon = typeIcons[product.type];
                    const status = inventoryStatus(product, products);
                    const physical = product.type !== 'floating' && product.type !== 'integrated';
                    const availability = getAvailability(product, products);
                    const categoryColor = categories.find((entry) => entry.name === product.category)?.color ?? '#64748b';
                    const marginValue = margin(product.cost, product.price);
                    const stockRatio = physical
                      ? Math.min(100, (product.stock / Math.max(product.minStock * 3, 1)) * 100)
                      : 0;
                    return (
                      <TableRow key={product.id} className="group">
                        <TableCell className="py-2.5">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="flex items-center gap-2.5 text-left"
                            title={`Editar ${product.name}`}
                          >
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                              style={{
                                borderColor: `${product.accent}30`,
                                backgroundColor: `${product.accent}10`,
                                color: product.accent,
                              }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate text-[11px] font-semibold">{product.name}</p>
                              <p className="flex items-center gap-1 truncate text-[9px] text-muted-foreground">
                                <span className="truncate">
                                  {product.sku}
                                  {product.barcode ? ` · ${product.barcode}` : ''}
                                </span>
                                {isLotTracked(product) ? (
                                  <span title="Maneja lotes / vencimientos" className="shrink-0 text-warning/80">
                                    <Tag className="h-2.5 w-2.5" />
                                  </span>
                                ) : null}
                                {isSerialTracked(product) ? (
                                  <span title="Maneja seriales" className="shrink-0 text-info/80">
                                    <Hash className="h-2.5 w-2.5" />
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <ProductTypeBadge type={product.type} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
                            {product.category}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {product.type === 'floating' ? (
                            <span className="text-[10px] text-muted-foreground">Sin inventario</span>
                          ) : product.type === 'integrated' ? (
                            <div>
                              <p
                                className={cn(
                                  'num text-[11px] font-semibold',
                                  status === 'out' ? 'text-destructive' : status === 'low' ? 'text-warning' : 'text-foreground',
                                )}
                              >
                                {availability} combos
                              </p>
                              <p className="text-[9px] text-muted-foreground">stock por componentes</p>
                            </div>
                          ) : (
                            <div>
                              <p
                                className={cn(
                                  'num text-[11px] font-semibold',
                                  status === 'out' ? 'text-destructive' : status === 'low' ? 'text-warning' : 'text-foreground',
                                )}
                              >
                                {formatNumber(product.stock, 2)} {product.unit}
                              </p>
                              <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted/40">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    status === 'out'
                                      ? 'bg-destructive'
                                      : status === 'low'
                                        ? 'bg-warning'
                                        : 'bg-success/80',
                                  )}
                                  style={{ width: `${Math.max(4, stockRatio)}%` }}
                                />
                              </div>
                              <p className="mt-0.5 text-[9px] text-muted-foreground">
                                mín. {formatNumber(product.minStock, 2)}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <p className="num text-[11px] font-semibold">{formatMoney(product.price, rate)}</p>
                          <p className="text-[9px] text-muted-foreground">costo {formatMoney(product.cost, rate)}</p>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span
                            className={cn(
                              'num inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                              marginValue >= 25
                                ? 'bg-success/10 text-success'
                                : marginValue >= 12
                                  ? 'bg-warning/10 text-warning'
                                  : 'bg-destructive/10 text-destructive',
                            )}
                          >
                            {marginValue.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={product.isActive ? 'success' : 'secondary'}>
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {physical && status !== 'ok' && product.isActive ? (
                              <span className={cn('text-[9px]', status === 'out' ? 'text-destructive' : 'text-warning')}>
                                {status === 'out' ? 'Agotado' : 'Stock bajo'}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${product.name}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEdit(product)}>
                                <Pencil /> Editar producto
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={!physical} onClick={() => openAdjust(product)}>
                                <SlidersHorizontal /> Ajustar inventario
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={!physical} onClick={() => openKardex(product)}>
                                <Eye /> Ver Kardex
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggle(product)}>
                                {product.isActive ? 'Desactivar' : 'Activar'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-3">
              <p className="text-[10px] text-muted-foreground">
                Mostrando{' '}
                <span className="num text-foreground">
                  {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)}
                </span>{' '}
                de <span className="num text-foreground">{filtered.length}</span> productos
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Anterior
                </Button>
                <span className="num px-2 text-[10px] text-muted-foreground">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kardex">
          <KardexPanel
            products={products}
            adjustments={adjustments}
            selectedProductId={kardexProductId}
            onSelectProduct={setKardexProductId}
            onAdjust={openAdjust}
            onEdit={openEdit}
          />
        </TabsContent>

        <TabsContent value="audit">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-start gap-2.5 border-b border-warning/10 bg-warning/[0.04] px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-warning">Bitácora de reemplazos absolutos</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  Cada ajuste fija el stock final, exige autorizante y motivo, y se refleja de inmediato en el
                  Kardex del producto y en la auditoría crítica del sistema.
                </p>
              </div>
              <span className="num shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground">
                {adjustments.length} registros
              </span>
            </div>

            {adjustments.length === 0 ? (
              <EmptyState
                icon={<SlidersHorizontal />}
                title="Sin ajustes registrados"
                description="Abre un producto y usa «Ajustar inventario» para registrar el primer reemplazo absoluto."
              />
            ) : (
              <Table className="min-w-[940px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
                    <TableHead className="text-right">Nuevo</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Justificación</TableHead>
                    <TableHead>Autorizante</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[70px] text-right">Kardex</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adjustment) => {
                    const product = products.find((entry) => entry.id === adjustment.productId);
                    return (
                      <TableRow key={adjustment.id}>
                        <TableCell>
                          <p className="text-[11px] font-medium">{adjustment.productName}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {product?.sku ?? adjustment.productId} · {adjustment.unit}
                          </p>
                        </TableCell>
                        <TableCell className="num text-right text-[11px]">
                          {formatNumber(adjustment.previousStock, 2)}
                        </TableCell>
                        <TableCell className="num text-right text-[11px] font-semibold">
                          {formatNumber(adjustment.newStock, 2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'num inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                              adjustment.difference < 0
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-success/10 text-success',
                            )}
                          >
                            {adjustment.difference > 0 ? '+' : ''}
                            {formatNumber(adjustment.difference, 2)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <p className="line-clamp-2 text-[10px] text-muted-foreground">{adjustment.reason}</p>
                        </TableCell>
                        <TableCell className="text-[10px]">{adjustment.issuer}</TableCell>
                        <TableCell className="whitespace-nowrap text-[9px] text-muted-foreground">
                          {formatDateTime(adjustment.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!product || product.type === 'floating' || product.type === 'integrated'}
                            onClick={() => product && openKardex(product)}
                            aria-label={`Ver Kardex de ${adjustment.productName}`}
                          >
                            <History className="h-3.5 w-3.5" />
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
      </Tabs>

      <ProductDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditingProduct(null);
        }}
        product={editingProduct}
      />

      <AdjustStockModal
        product={adjustingProduct}
        open={adjustingProduct !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustingProduct(null);
        }}
        onAdjusted={() => setTab('audit')}
      />
    </div>
  );
}
