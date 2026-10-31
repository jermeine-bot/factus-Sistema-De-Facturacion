import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  Boxes,
  ChevronRight,
  CircleDot,
  History,
  Package,
  Plus,
  Scale,
  Search,
  ShoppingCart,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { Product, ProductType } from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import { usePOSStore } from '@/store/usePOSStore';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
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
import { CartPanel } from '@/modules/pos/CartPanel';
import { UnitPickerDialog } from '@/modules/pos/UnitPickerDialog';
import { PaymentDialog } from '@/modules/pos/PaymentDialog';
import { formatMoney, formatNumber, stockStatus } from '@/utils/format';
import { getAvailability } from '@/utils/product';
import { cn } from '@/lib/utils';

type SortMode = 'default' | 'name' | 'price-asc' | 'stock-desc';

const typeOptions: Array<{ value: 'all' | ProductType; label: string }> = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'common', label: 'Comunes' },
  { value: 'grouped', label: 'Agrupados' },
  { value: 'integrated', label: 'Combos' },
  { value: 'floating', label: 'Servicios' },
];

function typeIcon(type: ProductType): typeof Package {
  if (type === 'grouped') return Scale;
  if (type === 'integrated') return Boxes;
  if (type === 'floating') return Sparkles;
  return Package;
}

export default function POSPage(): React.JSX.Element {
  const navigate = useNavigate();
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const sales = useSalesStore((state) => state.sales);
  const createProforma = useSalesStore((state) => state.createProforma);
  const addProduct = usePOSStore((state) => state.addProduct);
  const items = usePOSStore((state) => state.items);
  const customerId = usePOSStore((state) => state.customerId);
  const currency = usePOSStore((state) => state.currency);
  const notes = usePOSStore((state) => state.notes);
  const proformaId = usePOSStore((state) => state.proformaId);
  const clear = usePOSStore((state) => state.clear);
  const session = useCashStore((state) => state.current);
  const settings = useSettingsStore((state) => state.settings);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState<'all' | ProductType>('all');
  const [sort, setSort] = useState<SortMode>('default');
  const [unitPickerProduct, setUnitPickerProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const rate = settings.exchangeRate;

  const todaySales = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return sales.filter((sale) => sale.status === 'completed' && new Date(sale.createdAt) >= start);
  }, [sales]);
  const todayTotal = todaySales.reduce((acc, sale) => acc + sale.totals.total, 0);
  const expected = session ? sessionExpected(session) : 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = products.filter((product) => {
      if (!product.isActive) return false;
      if (category !== 'Todos' && product.category !== category) return false;
      if (typeFilter !== 'all' && product.type !== typeFilter) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode?.includes(term) ||
        product.category.toLowerCase().includes(term)
      );
    });

    if (sort === 'name') return [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price-asc') return [...result].sort((a, b) => a.price - b.price);
    if (sort === 'stock-desc') {
      return [...result].sort((a, b) => getAvailability(b, products) - getAvailability(a, products));
    }
    return result;
  }, [products, search, category, typeFilter, sort]);

  const handleProduct = (product: Product): void => {
    if (product.type === 'grouped') {
      setUnitPickerProduct(product);
      return;
    }
    try {
      addProduct(product, product.units[0]?.id ?? 'u-base', 1);
    } catch (error) {
      toast.error('No se pudo agregar', error instanceof Error ? error.message : undefined);
    }
  };

  const handleSaveProforma = (): void => {
    try {
      const proforma = createProforma({
        items,
        customerId,
        notes,
        validDays: 7,
      });
      toast.success(`Proforma ${proforma.number} creada`, 'Puedes convertirla a venta desde el módulo de proformas.');
      clear();
    } catch (error) {
      toast.error('No se pudo guardar la proforma', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Caja principal · ${session ? 'Turno abierto' : 'Sin turno'}`}
        title="Terminal de venta"
        description="Cobra en córdobas o dólares, aplica pagos divididos y convierte cotizaciones en facturas."
        icon={<ShoppingCart className="h-5 w-5" />}
        actions={
          <>
            <div className="hidden items-center gap-4 rounded-lg border border-border bg-muted/40 px-3.5 py-2 sm:flex">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Ventas de hoy</p>
                <p className="num mt-0.5 text-xs font-semibold">
                  {formatMoney(todayTotal, rate)}
                  <span className="ml-1.5 font-normal text-muted-foreground">({todaySales.length})</span>
                </p>
              </div>
              <div className="h-6 w-px bg-muted/40" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Efectivo en caja</p>
                <p className="num mt-0.5 text-xs font-semibold">{formatMoney(expected, rate)}</p>
              </div>
            </div>
            <Badge
              variant={session ? 'success' : 'warning'}
              className="h-8 cursor-pointer px-3"
              onClick={() => navigate('/caja')}
            >
              <CircleDot className="h-3 w-3" />
              {session ? 'Caja abierta' : 'Abrir caja'}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate('/ventas')}>
              <History className="h-3.5 w-3.5" /> Historial
            </Button>
          </>
        }
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-border bg-card p-3 backdrop-blur-xl">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, SKU o código de barras…"
                    className="h-9 w-full rounded-md border border-border bg-muted/40 pl-9 pr-3 text-xs placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    aria-label="Buscar productos"
                  />
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | ProductType)}>
                    <SelectTrigger className="h-9 w-[150px] text-[11px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}>
                    <SelectTrigger className="h-9 w-[152px] text-[11px]">
                      <ArrowDownUp className="mr-1 h-3 w-3 text-muted-foreground" />
                      <SelectValue placeholder="Orden" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Catálogo</SelectItem>
                      <SelectItem value="name">Nombre A-Z</SelectItem>
                      <SelectItem value="price-asc">Menor precio</SelectItem>
                      <SelectItem value="stock-desc">Mayor stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {['Todos', ...categories.map((entry) => entry.name)].map((name) => {
                  const active = category === name;
                  const count =
                    name === 'Todos'
                      ? products.filter((product) => product.isActive).length
                      : products.filter((product) => product.isActive && product.category === name).length;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCategory(name)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all',
                        active
                          ? 'border-primary/35 bg-primary/15 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600 hover:text-foreground',
                      )}
                    >
                      {name}
                      <span
                        className={cn(
                          'num rounded-full px-1 text-[9px]',
                          active ? 'bg-primary/20 text-primary' : 'bg-muted/40 text-muted-foreground/70',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-0.5">
            <p className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span> productos disponibles
              {search ? ` para “${search}”` : ''}
            </p>
            <p className="hidden text-[10px] text-muted-foreground/60 sm:block">
              Haz clic en un producto para agregarlo al ticket
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <EmptyState
                icon={<Search />}
                title="Sin coincidencias"
                description="Prueba con otro término, categoría o tipo de producto."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setCategory('Todos');
                      setTypeFilter('all');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((product) => {
                const Icon = typeIcon(product.type);
                const availability = getAvailability(product, products);
                const isGrouped = product.type === 'grouped';
                const stockTone =
                  product.type === 'floating'
                    ? 'text-info'
                    : stockStatus(availability, product.minStock) === 'ok'
                      ? 'text-muted-foreground'
                      : stockStatus(availability, product.minStock) === 'low'
                        ? 'text-warning'
                        : 'text-destructive';
                const disabled = product.type !== 'floating' && availability <= 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleProduct(product)}
                    className={cn(
                      'group relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-2.5 text-left shadow-sm transition-all duration-200 sm:p-3',
                      disabled
                        ? 'cursor-not-allowed opacity-45'
                        : 'hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-card hover:shadow-md',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-md border"
                        style={{
                          borderColor: `${product.accent}33`,
                          backgroundColor: `${product.accent}12`,
                          color: product.accent,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <ProductTypeBadge type={product.type} />
                    </div>

                    <p className="mt-2.5 line-clamp-2 min-h-[32px] text-[12px] font-semibold leading-snug">
                      {product.name}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-muted-foreground/70">
                      {product.sku} · {product.category}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-1 pt-2">
                      <div className="min-w-0">
                        <p className="num text-sm font-bold leading-none">
                          {formatMoney(product.price, currency, rate)}
                        </p>
                        <p className={cn('mt-1 truncate text-[9px]', stockTone)}>
                          {product.type === 'floating'
                            ? 'Precio editable'
                            : isGrouped
                              ? `${formatNumber(product.stock, 0)} ${product.unit} disp.`
                              : product.type === 'integrated'
                                ? `${availability} combos disp.`
                                : `${formatNumber(availability, 0)} ${product.unit} disp.`}
                        </p>
                      </div>
                      {!disabled ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-all group-hover:border-primary/30 group-hover:bg-primary/15 group-hover:text-primary">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-destructive">Agotado</span>
                      )}
                    </div>

                    {product.type === 'grouped' ? (
                      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[8px] font-medium text-warning opacity-0 transition-opacity group-hover:opacity-100">
                        <Scale className="h-2.5 w-2.5" /> Presentaciones <ChevronRight className="h-2 w-2" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-[10px] text-muted-foreground/60">
            <Wallet className="h-3.5 w-3.5 text-primary/70" />
            Tasa de cambio activa: <span className="num text-foreground/80">C$ {rate.toFixed(2)} por USD</span>
            <button
              type="button"
              onClick={() => navigate('/admin?tab=config')}
              className="ml-auto text-primary transition-colors hover:text-primary"
            >
              Actualizar tasa
            </button>
          </div>
        </div>

        <CartPanel
          onCheckout={() => {
            if (items.length === 0) return;
            setPaymentOpen(true);
          }}
          onSaveProforma={handleSaveProforma}
        />
      </div>

      <UnitPickerDialog
        product={unitPickerProduct}
        open={unitPickerProduct !== null}
        onOpenChange={(open) => {
          if (!open) setUnitPickerProduct(null);
        }}
        onConfirm={(unitId, quantity) => {
          if (!unitPickerProduct) return;
          try {
            addProduct(unitPickerProduct, unitId, quantity);
          } catch (error) {
            toast.error('No se pudo agregar', error instanceof Error ? error.message : undefined);
          }
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        items={items}
        customerId={customerId}
        currency={currency}
        exchangeRate={rate}
        notes={notes}
        proformaId={proformaId}
        onSuccess={() => clear()}
      />
    </div>
  );
}
