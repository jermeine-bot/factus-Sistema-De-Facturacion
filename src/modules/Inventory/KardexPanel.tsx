import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Download,
  Hash,
  History,
  Layers,
  PackagePlus,
  Pencil,
  Scale,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Undo2,
  Warehouse,
} from 'lucide-react';
import type { Product, StockAdjustment } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductTypeBadge } from '@/components/shared/product-type-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import {
  MOVEMENT_META,
  buildKardex,
  collectTraceability,
  expiryLabel,
  isLotTracked,
  isSerialTracked,
} from '@/modules/Inventory/inventoryData';
import type {
  KardexLot,
  KardexMovementType,
  KardexSerial,
} from '@/modules/Inventory/inventoryData';
import { downloadCsv, formatDate, formatDateTime, formatMoney, formatNumber } from '@/utils/format';
import { cn } from '@/lib/utils';

interface KardexPanelProps {
  products: Product[];
  adjustments: StockAdjustment[];
  selectedProductId: string | null;
  onSelectProduct: (productId: string) => void;
  onAdjust: (product: Product) => void;
  onEdit: (product: Product) => void;
}

type ListFilter = 'all' | 'lot' | 'serial';
type MovementFilter = 'all' | KardexMovementType;

const MOVEMENT_ICONS: Record<KardexMovementType, typeof Warehouse> = {
  initial: Warehouse,
  purchase: PackagePlus,
  sale: ShoppingCart,
  adjustment: SlidersHorizontal,
  return: Undo2,
};

const MOVEMENT_FILTERS: Array<{ value: MovementFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'sale', label: 'Ventas' },
  { value: 'purchase', label: 'Compras' },
  { value: 'adjustment', label: 'Ajustes' },
  { value: 'initial', label: 'Carga inicial' },
];

const LOT_TONES: Record<KardexLot['status'], string> = {
  valid: 'border-success/25 bg-success/10 text-success',
  expiring: 'border-warning/25 bg-warning/10 text-warning',
  expired: 'border-destructive/25 bg-destructive/10 text-destructive',
};

function formatCompactDate(iso: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(iso));
}

function formatCompactDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function LotBadge({ lot }: { lot?: KardexLot }): React.JSX.Element {
  if (!lot) return <span className="text-[10px] text-muted-foreground/50">—</span>;
  const compactExpiry = lot.status === 'expired'
    ? `Vencido ${Math.abs(lot.daysLeft)} d`
    : lot.daysLeft === 0
      ? 'Hoy'
      : lot.daysLeft === 1
        ? 'Mañana'
        : `${lot.daysLeft} d`;
  return (
    <div className="space-y-1" title={expiryLabel(lot)}>
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', LOT_TONES[lot.status])}>
        <Tag className="h-2.5 w-2.5" />
        {lot.code}
      </span>
      <p className={cn('flex items-center gap-1 whitespace-nowrap text-[9px]', lot.status === 'expired' ? 'text-destructive' : lot.status === 'expiring' ? 'text-warning' : 'text-muted-foreground')}>
        <CalendarClock className="h-2.5 w-2.5" />
        {compactExpiry} · {formatCompactDate(lot.expiresAt)}
      </p>
    </div>
  );
}

function SerialChips({ serials }: { serials?: KardexSerial[] }): React.JSX.Element {
  if (!serials || serials.length === 0) return <span className="text-[10px] text-muted-foreground/50">—</span>;
  const visible = serials.slice(0, 1);
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((serial) => (
        <span
          key={serial.code}
          title={serial.status === 'in_stock' ? 'En stock' : 'Vendido'}
          className={cn(
            'inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[8px]',
            serial.status === 'in_stock'
              ? 'border-success/20 bg-success/[0.07] text-success'
              : 'border-border bg-muted/40 text-muted-foreground',
          )}
        >
          <Hash className="h-2.5 w-2.5" />
          {serial.code}
        </span>
      ))}
      {serials.length > visible.length ? (
        <span
          title={serials.slice(visible.length).map((serial) => serial.code).join(', ')}
          className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] text-muted-foreground"
        >
          +{serials.length - visible.length}
        </span>
      ) : null}
    </div>
  );
}

export function KardexPanel({
  products,
  adjustments,
  selectedProductId,
  onSelectProduct,
  onAdjust,
  onEdit,
}: KardexPanelProps): React.JSX.Element {
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');

  const physicalProducts = useMemo(
    () => products.filter((product) => product.type !== 'floating' && product.type !== 'integrated'),
    [products],
  );

  const selected =
    physicalProducts.find((product) => product.id === selectedProductId) ?? physicalProducts[0] ?? null;
  const showLot = selected ? isLotTracked(selected) : false;
  const showSerial = selected ? isSerialTracked(selected) : false;

  useEffect(() => {
    if (!selectedProductId && physicalProducts[0]) onSelectProduct(physicalProducts[0].id);
  }, [selectedProductId, physicalProducts, onSelectProduct]);

  useEffect(() => {
    setMovementFilter('all');
  }, [selected?.id]);

  const movements = useMemo(
    () => (selected ? buildKardex(selected, adjustments) : []),
    [selected, adjustments],
  );

  const traceability = useMemo(() => collectTraceability(movements), [movements]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return physicalProducts.filter((product) => {
      if (term && !`${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(term)) return false;
      if (listFilter === 'lot' && !isLotTracked(product)) return false;
      if (listFilter === 'serial' && !isSerialTracked(product)) return false;
      return true;
    });
  }, [physicalProducts, search, listFilter]);

  const visibleMovements = useMemo(
    () => (movementFilter === 'all' ? movements : movements.filter((movement) => movement.type === movementFilter)),
    [movements, movementFilter],
  );

  const movementCounts = useMemo(() => {
    const counts: Record<string, number> = { all: movements.length };
    for (const movement of movements) counts[movement.type] = (counts[movement.type] ?? 0) + 1;
    return counts;
  }, [movements]);

  const tableMinWidth = showLot && showSerial
    ? 'min-w-[780px]'
    : showLot || showSerial
      ? 'min-w-[680px]'
      : 'min-w-[620px]';

  const handleExport = (): void => {
    if (!selected) return;
    const rows: Array<Array<string | number>> = [
      [
        'Fecha',
        'Tipo',
        'Referencia',
        'Detalle',
        'Lote',
        'Vence',
        'Seriales',
        'Cantidad',
        'Saldo',
        'Unidad',
        'Usuario',
        'Canal',
      ],
      ...movements.map((movement) => [
        formatDateTime(movement.createdAt),
        MOVEMENT_META[movement.type].label,
        movement.reference,
        movement.description,
        movement.lot?.code ?? '',
        movement.lot ? formatDate(movement.lot.expiresAt) : '',
        (movement.serials ?? []).map((serial) => serial.code).join(' | '),
        movement.quantity,
        movement.balance,
        movement.unit,
        movement.user,
        movement.channel,
      ]),
    ];
    downloadCsv(`kardex-${selected.sku.toLowerCase()}.csv`, rows);
    toast.success('Kardex exportado', `${movements.length} movimientos de ${selected.name}.`);
  };

  if (physicalProducts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <EmptyState
          icon={<History />}
          title="Sin productos trazables"
          description="Los servicios y combos no manejan stock físico propio. Crea un producto común o agrupado para ver su Kardex."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Productos trazables
            </p>
            <span className="num text-[9px] text-muted-foreground">{physicalProducts.length}</span>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar SKU o producto…"
            className="mt-2.5"
            ariaLabel="Buscar producto para Kardex"
          />
          <div className="mt-2 flex gap-1">
            {(
              [
                { value: 'all', label: 'Todos' },
                { value: 'lot', label: 'Lotes' },
                { value: 'serial', label: 'Seriales' },
              ] as Array<{ value: ListFilter; label: string }>
            ).map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setListFilter(entry.value)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-[9px] font-medium transition-colors',
                  listFilter === entry.value
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600 hover:text-foreground',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[720px] overflow-y-auto p-1.5">
          {filteredProducts.length === 0 ? (
            <p className="px-3 py-8 text-center text-[10px] text-muted-foreground">
              Ningún producto coincide con este filtro.
            </p>
          ) : (
            filteredProducts.map((product) => {
              const active = selected?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelectProduct(product.id)}
                  className={cn(
                    'mb-1 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'border-primary/30 bg-primary/[0.09]'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 hover:bg-muted/40',
                  )}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                    style={{
                      borderColor: `${product.accent}30`,
                      backgroundColor: `${product.accent}10`,
                      color: product.accent,
                    }}
                  >
                    {product.type === 'grouped' ? <Scale className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[11px] font-semibold', active && 'text-primary')}>
                      {product.name}
                    </p>
                    <p className="truncate text-[9px] text-muted-foreground">
                      {product.sku} · {formatNumber(product.stock, 2)} {product.unit}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isLotTracked(product) ? (
                      <span title="Maneja lotes" className="text-warning/80">
                        <Tag className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                    {isSerialTracked(product) ? (
                      <span title="Maneja seriales" className="text-info/80">
                        <Hash className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        {selected ? (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-3 border-b border-border bg-gradient-to-r from-primary/[0.06] via-transparent to-info/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: `${selected.accent}33`,
                      backgroundColor: `${selected.accent}12`,
                      color: selected.accent,
                    }}
                  >
                    {selected.type === 'grouped' ? <Scale className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-display text-base font-semibold">{selected.name}</h3>
                      <ProductTypeBadge type={selected.type} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {selected.sku} · {selected.category} · costo {formatMoney(selected.cost, rate)} / {selected.unit}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {isLotTracked(selected) ? (
                        <Badge variant="warning">
                          <Tag /> Lotes activos
                        </Badge>
                      ) : null}
                      {isSerialTracked(selected) ? (
                        <Badge variant="info">
                          <Hash /> Serializado
                        </Badge>
                      ) : null}
                      {!isLotTracked(selected) && !isSerialTracked(selected) ? (
                        <Badge variant="outline">Sin lote / serial</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => onEdit(selected)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" onClick={() => onAdjust(selected)}>
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
                <div className="p-3.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Existencia actual</p>
                  <p className="num mt-1 text-base font-bold">
                    {formatNumber(selected.stock, 2)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">{selected.unit}</span>
                  </p>
                  <p className="text-[9px] text-muted-foreground">mín. {formatNumber(selected.minStock, 2)}</p>
                </div>
                <div className="p-3.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Movimientos</p>
                  <p className="num mt-1 text-base font-bold">{movements.length}</p>
                  <p className="text-[9px] text-muted-foreground">movimientos registrados</p>
                </div>
                <div className="p-3.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Lotes</p>
                  <p className="num mt-1 text-base font-bold">{traceability.lots.length}</p>
                  <p className={cn('text-[9px]', traceability.expiringLots > 0 || traceability.expiredLots > 0 ? 'text-warning' : 'text-muted-foreground')}>
                    {traceability.expiredLots} vencidos · {traceability.expiringLots} por vencer
                  </p>
                </div>
                <div className="p-3.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Seriales</p>
                  <p className="num mt-1 text-base font-bold">{traceability.serials.length}</p>
                  <p className="text-[9px] text-muted-foreground">{traceability.serialsInStock} en stock</p>
                </div>
              </div>
            </div>

            {traceability.expiredLots > 0 || traceability.expiringLots > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/[0.05] px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-[10px] leading-relaxed text-warning/85">
                  <span className="font-semibold">Alerta de trazabilidad:</span>{' '}
                  {traceability.expiredLots > 0
                    ? `${traceability.expiredLots} lote(s) vencido(s) requieren retiro inmediato. `
                    : ''}
                  {traceability.expiringLots > 0
                    ? `${traceability.expiringLots} lote(s) vencen en los próximos 7 días.`
                    : ''}{' '}
                  Revisa la columna de vencimiento antes de vender.
                </p>
              </div>
            ) : null}

            {isLotTracked(selected) || isSerialTracked(selected) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {isLotTracked(selected) ? (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Tag className="h-3 w-3 text-warning" /> Lotes y vencimientos
                      </p>
                      <span className="num text-[9px] text-muted-foreground">{traceability.lots.length}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {traceability.lots.slice(0, 6).map((lot) => (
                        <span
                          key={lot.code}
                          className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium', LOT_TONES[lot.status])}
                        >
                          {lot.status !== 'valid' ? <AlertTriangle className="h-2.5 w-2.5" /> : <Tag className="h-2.5 w-2.5" />}
                          {lot.code} · {expiryLabel(lot)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {isSerialTracked(selected) ? (
                  <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Hash className="h-3 w-3 text-info" /> Seriales de alto valor
                      </p>
                      <span className="num text-[9px] text-muted-foreground">{traceability.serials.length}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {traceability.serials.slice(0, 6).map((serial) => (
                        <span
                          key={serial.code}
                          className={cn(
                            'inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[8px]',
                            serial.status === 'in_stock'
                              ? 'border-success/20 bg-success/[0.07] text-success'
                              : 'border-border bg-muted/40 text-muted-foreground',
                          )}
                        >
                          {serial.code}
                          <span className="font-sans text-[7px] uppercase tracking-wider opacity-70">
                            {serial.status === 'in_stock' ? 'stock' : 'vendido'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
                <div className="flex flex-wrap items-center gap-1">
                  {MOVEMENT_FILTERS.map((entry) => {
                    const count = movementCounts[entry.value] ?? 0;
                    return (
                      <button
                        key={entry.value}
                        type="button"
                        onClick={() => setMovementFilter(entry.value)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-medium transition-colors',
                          movementFilter === entry.value
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600 hover:text-foreground',
                        )}
                      >
                        {entry.label}
                        <span className="num text-[8px] opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 lg:ml-auto">
                  <span className="hidden text-[9px] text-muted-foreground xl:block">
                    {visibleMovements.length} movimientos · saldo actual {formatNumber(selected.stock, 2)} {selected.unit}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5" /> Exportar
                  </Button>
                </div>
              </div>

              {visibleMovements.length === 0 ? (
                <EmptyState
                  icon={<History />}
                  title="Sin movimientos en este filtro"
                  description="Cambia el tipo de movimiento o registra un ajuste para iniciar la trazabilidad."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className={tableMinWidth}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Movimiento</TableHead>
                        <TableHead>Detalle / responsable</TableHead>
                        {showLot ? <TableHead>Lote / vencimiento</TableHead> : null}
                        {showSerial ? <TableHead>Seriales</TableHead> : null}
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleMovements.map((movement) => {
                        const meta = MOVEMENT_META[movement.type];
                        const Icon = MOVEMENT_ICONS[movement.type];
                        return (
                          <TableRow key={movement.id} className="group">
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border [&_svg]:h-3.5 [&_svg]:w-3.5',
                                    meta.badge,
                                  )}
                                >
                                  <Icon />
                                </div>
                                <div>
                                  <span className={cn('inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider', meta.badge)}>
                                    {meta.label}
                                  </span>
                                  <p className="mt-1 font-mono text-[8px] text-muted-foreground">{movement.reference}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="w-[190px] max-w-[190px] py-2.5">
                              <p className="truncate text-[10px] text-foreground/90">{movement.description}</p>
                              <p className="mt-0.5 text-[9px] text-muted-foreground">
                                {movement.user} · {movement.channel}
                              </p>
                            </TableCell>
                            {showLot ? (
                              <TableCell className="py-2.5">
                                <LotBadge lot={movement.lot} />
                              </TableCell>
                            ) : null}
                            {showSerial ? (
                              <TableCell className="max-w-[150px] py-2.5">
                                <SerialChips serials={movement.serials} />
                              </TableCell>
                            ) : null}
                            <TableCell className="py-2.5 text-right">
                              <span
                                className={cn(
                                  'num inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                  movement.quantity > 0
                                    ? 'bg-success/10 text-success'
                                    : movement.quantity < 0
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-muted/40 text-muted-foreground',
                                )}
                              >
                                {movement.quantity > 0 ? (
                                  <ArrowUpRight className="h-2.5 w-2.5" />
                                ) : movement.quantity < 0 ? (
                                  <ArrowDownRight className="h-2.5 w-2.5" />
                                ) : null}
                                {movement.quantity > 0 ? '+' : ''}
                                {formatNumber(movement.quantity, 2)}
                              </span>
                            </TableCell>
                            <TableCell className="num py-2.5 text-right text-[10px] font-semibold">
                              {formatNumber(movement.balance, 2)}{' '}
                              <span className="text-[8px] font-normal text-muted-foreground">{movement.unit}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-2.5 text-[9px] text-muted-foreground">
                              {formatCompactDateTime(movement.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
