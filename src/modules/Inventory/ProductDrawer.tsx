import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  Boxes,
  Info,
  Lock,
  Package,
  Plus,
  Save,
  Scale,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import type {
  ComboComponent,
  Product,
  ProductDraft,
  ProductType,
  UnitOption,
} from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useAuditStore } from '@/store/useAuditStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatMoney, formatNumber, round2, uid } from '@/utils/format';
import { getAvailability, PRODUCT_TYPE_META } from '@/utils/product';
import { cn } from '@/lib/utils';

interface ProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSaved?: (product: Product, mode: 'create' | 'edit') => void;
}

type FormTab = 'basic' | 'units' | 'combo';

interface ProductFormState {
  name: string;
  sku: string;
  description: string;
  category: string;
  type: ProductType;
  cost: string;
  price: string;
  stock: string;
  minStock: string;
  unit: string;
  taxRate: string;
  barcode: string;
  isActive: boolean;
}

interface PresentationDraft {
  id: string;
  name: string;
  abbreviation: string;
  ratio: number;
  price: number;
  barcode?: string;
}

const COMMON_UNITS = ['unidad', 'lb', 'kg', 'caja', 'paquete', 'litro', 'docena', 'bolsa'];

interface ComponentDraft {
  productId: string;
  quantity: number;
}

const TYPE_OPTIONS: Array<{
  value: ProductType;
  icon: typeof Package;
  hint: string;
}> = [
  { value: 'common', icon: Package, hint: 'Inventario 1:1' },
  { value: 'floating', icon: Sparkles, hint: 'Servicio sin stock' },
  { value: 'integrated', icon: Boxes, hint: 'Combo de componentes' },
  { value: 'grouped', icon: Scale, hint: 'Multi-unidad' },
];

function emptyForm(category: string): ProductFormState {
  return {
    name: '',
    sku: '',
    description: '',
    category,
    type: 'common',
    cost: '0',
    price: '0',
    stock: '0',
    minStock: '0',
    unit: 'unidad',
    taxRate: '15',
    barcode: '',
    isActive: true,
  };
}

export function ProductDrawer({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductDrawerProps): React.JSX.Element {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const createProduct = useCatalogStore((state) => state.createProduct);
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const addLog = useAuditStore((state) => state.addLog);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const isEdit = product !== null;
  const [tab, setTab] = useState<FormTab>('basic');
  const [form, setForm] = useState<ProductFormState>(() => emptyForm(categories[0]?.name ?? 'Abarrotes'));
  const [presentations, setPresentations] = useState<PresentationDraft[]>([]);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [componentQuantity, setComponentQuantity] = useState('1');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setTab('basic');
    setCandidateId('');
    setComponentQuantity('1');

    if (!product) {
      setForm(emptyForm(categories[0]?.name ?? 'Abarrotes'));
      setPresentations([]);
      setComponents([]);
      return;
    }

    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description,
      category: product.category,
      type: product.type,
      cost: String(product.cost),
      price: String(product.price),
      stock: String(product.stock),
      minStock: String(product.minStock),
      unit: product.unit,
      taxRate: String(round2(product.taxRate * 100)),
      barcode: product.barcode ?? '',
      isActive: product.isActive,
    });
    setPresentations(
      product.units
        .filter((unit) => unit.ratio > 1)
        .map((unit) => ({
          id: unit.id,
          name: unit.name,
          abbreviation: unit.abbreviation,
          ratio: unit.ratio,
          price: unit.price,
          barcode: unit.barcode ?? '',
        })),
    );
    setComponents(product.components.map((component) => ({ ...component })));
  }, [open, product, categories]);

  const componentCandidates = useMemo(
    () =>
      products.filter(
        (entry) =>
          entry.id !== product?.id &&
          entry.type !== 'integrated' &&
          entry.type !== 'floating' &&
          entry.isActive,
      ),
    [products, product],
  );

  const selectedCandidateId = candidateId || componentCandidates[0]?.id || '';

  const componentCost = useMemo(
    () =>
      round2(
        components.reduce((acc, component) => {
          const entry = products.find((item) => item.id === component.productId);
          return acc + (entry?.cost ?? 0) * component.quantity;
        }, 0),
      ),
    [components, products],
  );

  const isPhysical = form.type === 'common' || form.type === 'grouped';
  const stockLocked = isEdit;
  const stockDisabled = stockLocked || !isPhysical;
  const parsedCost = Number(form.cost) || 0;
  const parsedPrice = Number(form.price) || 0;
  const parsedStock = stockLocked ? product.stock : Number(form.stock) || 0;
  const stockValue = isPhysical ? round2(parsedStock * parsedPrice) : 0;
  const initialCostInvestment = isPhysical ? round2(parsedStock * parsedCost) : 0;
  const grossProfit = round2(parsedPrice - parsedCost);
  const profitMargin = parsedPrice > 0 ? round2(((parsedPrice - parsedCost) / parsedPrice) * 100) : 0;
  const isLoss = parsedPrice > 0 && parsedCost > parsedPrice;

  function updateField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]): void {
    setForm((state) => ({ ...state, [key]: value }));
  }

  const handleGenerateSku = (): void => {
    const rawCategory = form.category || 'PRD';
    const cleanPrefix = rawCategory.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'PRD');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    updateField('sku', `${cleanPrefix}-${randomSuffix}`);
  };

  const handleGenerateBarcode = (): void => {
    const randomCode = '742' + Math.floor(100000000 + Math.random() * 900000000).toString();
    updateField('barcode', randomCode);
  };

  const addPresentation = (): void => {
    setPresentations((state) => [
      ...state,
      {
        id: uid('unit'),
        name: '',
        abbreviation: '',
        ratio: 2,
        price: round2(parsedPrice * 2),
        barcode: '',
      },
    ]);
  };

  const removePresentation = (id: string): void => {
    setPresentations((state) => state.filter((entry) => entry.id !== id));
  };

  const addComponent = (): void => {
    setError('');
    if (!selectedCandidateId) {
      setError('Selecciona un producto para agregar al combo.');
      return;
    }
    if (components.some((entry) => entry.productId === selectedCandidateId)) {
      setError('Ese componente ya está incluido en el combo.');
      return;
    }
    const quantity = Number(componentQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('La cantidad del componente debe ser mayor que cero.');
      return;
    }
    setComponents((state) => [...state, { productId: selectedCandidateId, quantity: round2(quantity) }]);
    setCandidateId('');
    setComponentQuantity('1');
  };

  const handleSave = (): void => {
    setError('');
    try {
      const name = form.name.trim();
      const sku = form.sku.trim().toUpperCase();
      const category = form.category.trim();
      const price = Number(form.price);
      const cost = Number(form.cost);
      const tax = Number(form.taxRate);
      const physicalStock = Number(form.stock);
      const minStock = Number(form.minStock);

      if (!name) throw new Error('El nombre del producto es obligatorio.');
      if (!sku) throw new Error('El SKU / código es obligatorio.');
      if (!category) throw new Error('Selecciona una categoría.');
      if (!Number.isFinite(price) || price < 0) throw new Error('El precio de venta debe ser válido.');
      if (!Number.isFinite(cost) || cost < 0) throw new Error('El costo debe ser válido.');
      if (!Number.isFinite(tax) || tax < 0 || tax > 100) throw new Error('El IVA debe estar entre 0 y 100%.');
      if (!isEdit && isPhysical && (!Number.isFinite(physicalStock) || physicalStock < 0)) {
        throw new Error('El stock inicial debe ser mayor o igual a cero.');
      }
      if (isPhysical && (!Number.isFinite(minStock) || minStock < 0)) {
        throw new Error('El stock mínimo debe ser mayor o igual a cero.');
      }
      if (products.some((entry) => entry.sku.toLowerCase() === sku.toLowerCase() && entry.id !== product?.id)) {
        throw new Error(`El SKU ${sku} ya está en uso por otro producto.`);
      }
      if (form.type === 'grouped') {
        if (presentations.some((entry) => !entry.name.trim() || !entry.abbreviation.trim())) {
          throw new Error('Completa el nombre y la abreviatura de cada presentación.');
        }
        if (presentations.some((entry) => !Number.isFinite(entry.ratio) || entry.ratio <= 1)) {
          throw new Error('Cada presentación adicional debe contener más de una unidad base.');
        }
        if (presentations.some((entry) => !Number.isFinite(entry.price) || entry.price <= 0)) {
          throw new Error('Cada presentación debe tener un precio mayor que cero.');
        }
      }
      if (form.type === 'integrated') {
        if (components.length === 0) throw new Error('Un combo debe tener al menos un componente.');
        if (components.some((entry) => entry.quantity <= 0)) {
          throw new Error('Las cantidades de los componentes deben ser mayores que cero.');
        }
      }

      const currentBase = product?.units.find((unit) => unit.ratio === 1) ?? product?.units[0];
      const baseUnit: UnitOption = {
        id: currentBase?.id ?? 'u-base',
        name: form.unit.trim() || 'Unidad',
        abbreviation: form.unit.trim() || 'u',
        ratio: 1,
        price: round2(price),
        barcode: form.barcode.trim() || currentBase?.barcode,
      };

      const units: UnitOption[] =
        form.type === 'grouped'
          ? [
              baseUnit,
              ...presentations.map((entry) => ({
                id: entry.id,
                name: entry.name.trim(),
                abbreviation: entry.abbreviation.trim(),
                ratio: entry.ratio,
                price: round2(entry.price),
                barcode: entry.barcode?.trim() || undefined,
              })),
            ]
          : [baseUnit];

      const draft: ProductDraft = {
        name,
        sku,
        description: form.description.trim(),
        category,
        type: form.type,
        cost: round2(cost),
        price: round2(price),
        stock: isPhysical ? round2(isEdit ? product.stock : physicalStock) : 0,
        minStock: isPhysical ? round2(minStock) : 0,
        unit: form.unit.trim() || 'unidad',
        taxRate: round2(tax) / 100,
        barcode: form.barcode.trim() || undefined,
        isActive: form.isActive,
        units,
        components: components.map<ComboComponent>((entry) => ({
          productId: entry.productId,
          quantity: entry.quantity,
        })),
      };

      if (product) {
        const updated = updateProduct(product.id, draft);
        addLog({
          action: 'product_updated',
          entity: 'Producto',
          entityId: product.id,
          description: `${updated.name} actualizado desde el catálogo. Stock físico protegido en ${formatNumber(product.stock, 2)} ${product.unit}.`,
          userId: currentUser.id,
          userName: currentUser.name,
          severity: 'info',
          metadata: {
            sku: updated.sku,
            precio: updated.price,
            costo: updated.cost,
            stockBloqueado: product.stock,
          },
        });
        toast.success('Producto actualizado', `${updated.name} · stock físico intacto (bloqueado).`);
        onSaved?.(updated, 'edit');
      } else {
        const created = createProduct(draft);
        addLog({
          action: 'product_created',
          entity: 'Producto',
          entityId: created.id,
          description: `${created.name} (${created.sku}) creado como ${PRODUCT_TYPE_META[created.type].label}.`,
          userId: currentUser.id,
          userName: currentUser.name,
          severity: 'info',
          metadata: {
            stockInicial: created.stock,
            precio: created.price,
            tipo: created.type,
          },
        });
        toast.success('Producto creado', `${created.name} ya está disponible en el catálogo.`);
        onSaved?.(created, 'create');
      }

      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el producto.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] max-w-4xl flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl"
        aria-describedby="product-drawer-description"
      >
        <DialogHeader className="shrink-0 border-b border-border bg-gradient-to-r from-primary/[0.08] via-card to-card px-6 py-4 pr-12">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              {isEdit ? <Package className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg">
                  {isEdit ? 'Editar producto' : 'Nuevo producto'}
                </DialogTitle>
                <Badge variant={isEdit ? 'warning' : 'success'}>{isEdit ? 'Edición' : 'Alta'}</Badge>
              </div>
              <DialogDescription id="product-drawer-description" className="mt-1 max-w-[560px]">
                {isEdit
                  ? 'Actualiza precio, presentaciones y componentes. El stock físico permanece bloqueado por política de auditoría.'
                  : 'Configura la ficha maestra, sus conversiones multi-unidad o la composición del combo.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Tabs value={tab} onValueChange={(value) => setTab(value as FormTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">
                <Package /> Básica
              </TabsTrigger>
              <TabsTrigger value="units">
                <Scale /> Multi-unidad
                {presentations.length > 0 ? (
                  <span className="num rounded bg-muted/40 px-1 text-[9px]">{presentations.length}</span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="combo">
                <Boxes /> Componentes
                {components.length > 0 ? (
                  <span className="num rounded bg-muted/40 px-1 text-[9px]">{components.length}</span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-5 space-y-5">
              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Tipo de producto
                  </p>
                  {isEdit ? (
                    <span className="flex items-center gap-1 text-[9px] text-warning/80">
                      <Lock className="h-2.5 w-2.5" /> tipo bloqueado
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {TYPE_OPTIONS.map((option) => {
                    const meta = PRODUCT_TYPE_META[option.value];
                    const Icon = option.icon;
                    const active = form.type === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isEdit}
                        onClick={() => updateField('type', option.value)}
                        className={cn(
                          'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all',
                          active
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20 dark:border-blue-500/50 dark:bg-blue-500/10'
                            : 'border-border bg-muted/40 hover:border-slate-300 dark:hover:border-slate-600',
                          isEdit && !active && 'opacity-35',
                          isEdit && 'cursor-not-allowed',
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                            active
                              ? 'border-primary/25 bg-primary/15 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold">{meta.short}</p>
                          <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">{option.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {form.type === 'integrated' && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-xs text-primary">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 shrink-0" />
                      <span>Has seleccionado <strong>Combo</strong>. Descuenta automáticamente el stock de sus partes.</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => setTab('combo')}
                    >
                      Configurar componentes <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}

                {form.type === 'grouped' && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 shrink-0" />
                      <span>Has seleccionado <strong>Multi-unidad</strong>. Permite vender por libra, caja o quintal.</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
                      onClick={() => setTab('units')}
                    >
                      Configurar presentaciones <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="drawer-name">Nombre del producto *</Label>
                  <Input
                    id="drawer-name"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Ej. Café Molido Selecto 500 g"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="drawer-sku">SKU / Código *</Label>
                    {!isEdit && (
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                        title="Generar código automático"
                      >
                        <Wand2 className="h-3 w-3" /> Auto
                      </button>
                    )}
                  </div>
                  <Input
                    id="drawer-sku"
                    value={form.sku}
                    onChange={(event) => updateField('sku', event.target.value)}
                    placeholder="CAF-MOL-004"
                    className="h-9 font-mono text-xs uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoría</Label>
                  <Select value={form.category} onValueChange={(value) => updateField('category', value)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((entry) => (
                        <SelectItem key={entry.id} value={entry.name}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="drawer-barcode">Código de barras</Label>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      title="Generar código de barras"
                    >
                      <Barcode className="h-3 w-3" /> Generar
                    </button>
                  </div>
                  <Input
                    id="drawer-barcode"
                    value={form.barcode}
                    onChange={(event) => updateField('barcode', event.target.value)}
                    placeholder="7421001000042"
                    className="h-9 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-unit">Unidad base</Label>
                  <Input
                    id="drawer-unit"
                    value={form.unit}
                    onChange={(event) => updateField('unit', event.target.value)}
                    placeholder="unidad, lb, caja…"
                    disabled={isEdit && form.type === 'grouped'}
                    className="h-9 text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[9px] text-muted-foreground mr-1">Rápidos:</span>
                    {COMMON_UNITS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        disabled={isEdit && form.type === 'grouped'}
                        onClick={() => updateField('unit', u)}
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[9px] transition-colors',
                          form.unit.toLowerCase() === u.toLowerCase()
                            ? 'border-primary/40 bg-primary/10 font-semibold text-primary'
                            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-cost">Costo (C$)</Label>
                    <Input
                      id="drawer-cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.cost}
                      onChange={(event) => updateField('cost', event.target.value)}
                      className="num h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-price">Precio venta (C$)</Label>
                    <Input
                      id="drawer-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onChange={(event) => updateField('price', event.target.value)}
                      className="num h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="drawer-tax">IVA (%)</Label>
                    <Input
                      id="drawer-tax"
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={form.taxRate}
                      onChange={(event) => updateField('taxRate', event.target.value)}
                      className="num h-9 text-xs"
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs',
                    isLoss
                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                      : 'border-border bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md border',
                        isLoss
                          ? 'border-destructive/30 bg-destructive/20 text-destructive'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
                      )}
                    >
                      {isLoss ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Ganancia unitaria
                      </p>
                      <p className={cn('num text-xs font-bold', isLoss ? 'text-destructive' : 'text-emerald-500')}>
                        {formatMoney(grossProfit, rate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-l border-border/60 pl-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Margen comercial
                      </p>
                      <p
                        className={cn(
                          'num text-xs font-bold',
                          isLoss
                            ? 'text-destructive'
                            : profitMargin >= 30
                              ? 'text-emerald-500'
                              : 'text-foreground',
                        )}
                      >
                        {profitMargin}%
                      </p>
                    </div>
                  </div>
                  {!isEdit && isPhysical && parsedStock > 0 && (
                    <div className="flex items-center gap-2 border-l border-border/60 pl-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Inversión en stock
                        </p>
                        <p className="num text-xs font-bold text-foreground">
                          {formatMoney(initialCostInvestment, rate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {isLoss && (
                    <p className="w-full text-[10px] font-medium text-destructive">
                      Atención: El precio de venta fijado es menor que el costo unitario.
                    </p>
                  )}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-stock" className="flex items-center gap-1.5">
                    {stockLocked ? <Lock className="h-3 w-3 text-warning" /> : null}
                    Stock físico {stockLocked ? '(bloqueado)' : '(inicial)'}
                  </Label>
                  {stockLocked ? (
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="relative block cursor-not-allowed" tabIndex={0}>
                            <Input
                              id="drawer-stock"
                              type="number"
                              value={form.stock}
                              disabled
                              className="num h-9 cursor-not-allowed border-border bg-muted/60 pr-9 text-muted-foreground"
                            />
                            <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warning/70" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[280px] p-3 font-normal leading-relaxed">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                            <ShieldAlert className="h-3.5 w-3.5" /> Reemplazo absoluto obligatorio
                          </p>
                          <p className="mt-1.5 text-[10px] text-slate-300">
                            El stock no se edita desde la ficha. Debe registrarse un ajuste de inventario que
                            fija la existencia final y exige autorizante, motivo y auditoría crítica.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Input
                      id="drawer-stock"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.stock}
                      onChange={(event) => updateField('stock', event.target.value)}
                      disabled={stockDisabled}
                      className="num h-9 text-xs"
                    />
                  )}
                  <p className="text-[9px] leading-relaxed text-muted-foreground">
                    {stockLocked
                      ? 'Solo modificable con un ajuste auditado de inventario.'
                      : !isPhysical
                        ? 'Este tipo de producto no maneja stock físico.'
                        : 'Existencia inicial en unidad base.'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-min">Stock mínimo</Label>
                  <Input
                    id="drawer-min"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.minStock}
                    onChange={(event) => updateField('minStock', event.target.value)}
                    disabled={!isPhysical}
                    className="num h-9 text-xs"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    {isPhysical ? 'Activa alertas de reposición.' : 'No aplica para este tipo.'}
                  </p>
                </div>
              </section>

              {stockLocked ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/15 bg-warning/[0.045] px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <p className="text-[10px] leading-relaxed text-warning/80">
                    El stock actual es <span className="num font-semibold">{formatNumber(product.stock, 2)} {product.unit}</span>.
                    Usa <span className="font-semibold">Ajustar inventario</span> para un reemplazo absoluto con trazabilidad.
                  </p>
                </div>
              ) : null}

              <section className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <div className="space-y-1.5">
                  <Label htmlFor="drawer-description">Descripción comercial</Label>
                  <Textarea
                    id="drawer-description"
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    placeholder="Detalle del producto, presentación y uso…"
                    className="min-h-[80px] text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <div className="flex h-[42px] items-center justify-between rounded-md border border-border bg-muted/40 px-3">
                    <span className="text-[10px] text-muted-foreground">
                      {form.isActive ? 'Activo y vendible' : 'Inactivo / oculto'}
                    </span>
                    <Switch checked={form.isActive} onCheckedChange={(value) => updateField('isActive', value)} />
                  </div>
                  <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[9px] text-muted-foreground">
                    Valor a precio de venta:{' '}
                    <span className="num font-semibold text-foreground">
                      {formatMoney(stockValue, rate)}
                    </span>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="units" className="mt-5 space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-warning/20 bg-warning/10 text-warning">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Matriz de conversión</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      Un solo inventario en <span className="text-warning">{form.unit || 'unidad base'}</span>.
                      Cada presentación indica cuántas unidades base contiene y su precio de venta.
                    </p>
                  </div>
                </div>
              </div>

              {form.type === 'grouped' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Presentaciones
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={addPresentation}>
                      <Plus className="h-3.5 w-3.5" /> Agregar
                    </Button>
                  </div>

                  <div className="grid grid-cols-[1fr_60px_56px_84px_110px_28px] gap-1.5 px-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <span>Nombre</span>
                    <span>Abrev.</span>
                    <span>Factor</span>
                    <span>Precio</span>
                    <span>Cód. barras</span>
                    <span />
                  </div>

                  <div className="flex items-center gap-2 rounded-md border border-warning/15 bg-warning/[0.04] px-2.5 py-2">
                    <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
                      BASE
                    </span>
                    <span className="flex-1 text-[11px]">{form.unit || 'unidad'} · factor 1</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{form.barcode || 'Sin código'}</span>
                    <span className="num text-[11px] font-semibold">{formatMoney(parsedPrice, rate)}</span>
                  </div>

                  {presentations.map((presentation, index) => (
                    <div key={presentation.id} className="grid grid-cols-[1fr_60px_56px_84px_110px_28px] gap-1.5">
                      <Input
                        value={presentation.name}
                        onChange={(event) =>
                          setPresentations((state) =>
                            state.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, name: event.target.value } : entry,
                            ),
                          )
                        }
                        placeholder="Quintal 100 lb"
                        className="h-8 text-[11px]"
                        aria-label="Nombre de presentación"
                      />
                      <Input
                        value={presentation.abbreviation}
                        onChange={(event) =>
                          setPresentations((state) =>
                            state.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, abbreviation: event.target.value } : entry,
                            ),
                          )
                        }
                        placeholder="qq"
                        className="h-8 text-[11px]"
                        aria-label="Abreviatura"
                      />
                      <Input
                        type="number"
                        min={1.01}
                        step="0.01"
                        value={presentation.ratio}
                        onChange={(event) =>
                          setPresentations((state) =>
                            state.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, ratio: Math.max(1.01, Number(event.target.value) || 1.01) }
                                : entry,
                            ),
                          )
                        }
                        className="num h-8 text-[11px]"
                        aria-label="Factor de conversión"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={presentation.price}
                        onChange={(event) =>
                          setPresentations((state) =>
                            state.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, price: Number(event.target.value) || 0 }
                                : entry,
                            ),
                          )
                        }
                        className="num h-8 text-[11px]"
                        aria-label="Precio de la presentación"
                      />
                      <Input
                        value={presentation.barcode ?? ''}
                        onChange={(event) =>
                          setPresentations((state) =>
                            state.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, barcode: event.target.value } : entry,
                            ),
                          )
                        }
                        placeholder="Cód. barras"
                        className="h-8 font-mono text-[11px]"
                        aria-label="Código de barras"
                      />
                      <button
                        type="button"
                        onClick={() => removePresentation(presentation.id)}
                        className="flex items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Eliminar presentación"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {presentations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
                      <Scale className="mx-auto h-5 w-5 text-muted-foreground/60" />
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Aún no hay presentaciones. La unidad base sigue disponible.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[9px] text-muted-foreground">
                      {presentations.length} presentación{presentations.length === 1 ? '' : 'es'} adicional
                      {presentations.length === 1 ? '' : 'es'} · conversión automática al vender.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-5 py-7 text-center">
                  <Scale className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-2 text-xs font-medium">Este producto no usa conversiones</p>
                  <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
                    El tipo agrupado permite vender la misma existencia base por libra, arroba o quintal,
                    manteniendo un único stock físico.
                  </p>
                  {!isEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      className="mt-3"
                      onClick={() => updateField('type', 'grouped')}
                    >
                      <Scale className="h-3.5 w-3.5" /> Convertir a agrupado
                    </Button>
                  ) : (
                    <p className="mt-3 text-[9px] text-warning/80">El tipo está bloqueado en edición.</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="combo" className="mt-5 space-y-4">
              <div className="rounded-lg border border-primary/15 bg-primary/[0.035] p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Composición del combo</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      El combo no guarda stock propio: cada venta descuenta los componentes en cascada.
                      Costo estimado:{' '}
                      <span className="num font-semibold text-primary">{formatMoney(componentCost, rate)}</span>.
                    </p>
                  </div>
                </div>
              </div>

              {form.type === 'integrated' ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5 sm:flex-row">
                    <Select value={selectedCandidateId} onValueChange={setCandidateId}>
                      <SelectTrigger className="h-9 flex-1 text-[11px]">
                        <SelectValue placeholder="Selecciona un componente" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentCandidates.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name} · {formatNumber(entry.stock, 2)} {entry.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={componentQuantity}
                        onChange={(event) => setComponentQuantity(event.target.value)}
                        className="num h-9 w-20 text-[11px]"
                        aria-label="Cantidad del componente"
                      />
                      <Button type="button" size="sm" variant="secondary" onClick={addComponent}>
                        <Plus className="h-3.5 w-3.5" /> Agregar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {components.map((component) => {
                      const entry = products.find((item) => item.id === component.productId);
                      const available = entry
                        ? Math.floor(getAvailability(entry, products) / Math.max(component.quantity, 0.01))
                        : 0;
                      return (
                        <div
                          key={component.productId}
                          className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">{entry?.name ?? component.productId}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {formatNumber(component.quantity, 2)} {entry?.unit} por combo · {available} combos disponibles
                            </p>
                          </div>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={component.quantity}
                            onChange={(event) =>
                              setComponents((state) =>
                                state.map((item) =>
                                  item.productId === component.productId
                                    ? { ...item, quantity: Math.max(0.01, Number(event.target.value) || 0.01) }
                                    : item,
                                ),
                              )
                            }
                            className="num h-7 w-16 text-[10px]"
                            aria-label="Cantidad en el combo"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setComponents((state) => state.filter((item) => item.productId !== component.productId))
                            }
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Quitar componente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {components.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
                        <Boxes className="mx-auto h-5 w-5 text-muted-foreground/60" />
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Agrega al menos un producto como componente del combo.
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-[10px]">
                    <span className="text-muted-foreground">{components.length} componentes</span>
                    <span className="num font-semibold">Costo {formatMoney(componentCost, rate)}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-5 py-7 text-center">
                  <Boxes className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-2 text-xs font-medium">Este producto no es un combo</p>
                  <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
                    Convierte el producto en un combo integrado para vender varios artículos como una sola
                    línea, descontando el stock de cada componente.
                  </p>
                  {!isEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      className="mt-3"
                      onClick={() => updateField('type', 'integrated')}
                    >
                      <Boxes className="h-3.5 w-3.5" /> Usar tipo combo
                    </Button>
                  ) : (
                    <p className="mt-3 text-[9px] text-warning/80">El tipo está bloqueado en edición.</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-info" />
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              Los cambios de ficha quedan registrados en la bitácora. El stock físico solo se altera mediante
              ajuste absoluto auditado.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-muted/30 px-6 py-4">
          {error ? (
            <div className="mb-2.5 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-[9px] text-muted-foreground sm:block">
              {isEdit ? 'Stock protegido por auditoría' : 'El stock inicial se registra al crear'}
            </p>
            <div className="flex flex-1 justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5" /> {isEdit ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
