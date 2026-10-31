import type { CartItem, Product, ProductType, SaleItem } from '@/types';

export const PRODUCT_TYPE_META: Record<
  ProductType,
  { label: string; short: string; description: string; tone: string }
> = {
  common: {
    label: 'Producto común',
    short: 'Común',
    description: 'Inventario 1:1. Descuenta una unidad por cada unidad vendida.',
    tone: 'bg-info/10 text-info border-info/25',
  },
  floating: {
    label: 'Servicio / Precio libre',
    short: 'Flotante',
    description: 'No maneja inventario. Permite editar descripción y precio en la venta.',
    tone: 'bg-info/10 text-info border-info/25',
  },
  integrated: {
    label: 'Combo integrado',
    short: 'Integrado',
    description: 'No tiene stock propio. Al venderse descuenta el stock de sus componentes.',
    tone: 'bg-primary/10 text-primary border-primary/25',
  },
  grouped: {
    label: 'Producto agrupado',
    short: 'Agrupado',
    description: 'Un solo inventario base con matriz de conversión por presentaciones.',
    tone: 'bg-warning/10 text-warning border-warning/25',
  },
};

export function getUnit(product: Product, unitId: string): Product['units'][number] {
  return product.units.find((unit) => unit.id === unitId) ?? product.units[0];
}

/**
 * Availability expressed in the product's natural sale granularity:
 * - common/grouped → base units
 * - integrated → number of complete combos buildable
 * - floating → Infinity
 */
export function getAvailability(product: Product, catalog: Product[], depth = 0): number {
  if (product.type === 'floating') return Number.POSITIVE_INFINITY;
  if (product.type !== 'integrated') return product.stock;
  if (depth > 4) return 0;

  let available = Number.POSITIVE_INFINITY;
  for (const component of product.components) {
    const child = catalog.find((item) => item.id === component.productId);
    if (!child) return 0;
    const childAvailability = getAvailability(child, catalog, depth + 1);
    const required = component.quantity > 0 ? component.quantity : 1;
    available = Math.min(available, Math.floor(childAvailability / required));
  }
  return Number.isFinite(available) ? available : 0;
}

export function getUnitAvailability(
  product: Product,
  unitId: string,
  catalog: Product[],
): number {
  if (product.type === 'floating') return Number.POSITIVE_INFINITY;
  const availability = getAvailability(product, catalog);
  if (product.type === 'integrated') return availability;
  const unit = getUnit(product, unitId);
  return Math.floor((availability / (unit.ratio || 1)) * 100) / 100;
}

export function isSellable(product: Product, catalog: Product[], unitId: string, quantity: number): boolean {
  return getUnitAvailability(product, unitId, catalog) >= quantity;
}

export function describeComponents(product: Product, catalog: Product[]): string {
  if (product.type !== 'integrated') return '';
  return product.components
    .map((component) => {
      const child = catalog.find((item) => item.id === component.productId);
      return `${component.quantity} ${child?.unit ?? 'u'} · ${child?.name ?? 'Componente'}`;
    })
    .join(' + ');
}

export function cartItemFromProduct(
  product: Product,
  unitId: string,
  lineId: string,
  quantity = 1,
): CartItem {
  const unit = getUnit(product, unitId);
  return {
    lineId,
    productId: product.id,
    name: product.name,
    type: product.type,
    unitId: unit.id,
    unitLabel: unit.name,
    quantity,
    unitPrice: unit.price,
    unitCost: product.cost * unit.ratio,
    discount: 0,
    taxRate: product.taxRate,
    description: product.type === 'floating' ? product.name : undefined,
    components: product.components.map((component) => ({ ...component })),
    accent: product.accent,
  };
}

export function saleItemFromCart(item: CartItem, total: number, unitRatio: number): SaleItem {
  return {
    productId: item.productId,
    name: item.name,
    type: item.type,
    unitLabel: item.unitLabel,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitRatio,
    discount: item.discount,
    taxRate: item.taxRate,
    total,
    description: item.description,
    components: item.components,
  };
}

export function availabilityLabel(product: Product, catalog: Product[]): string {
  if (product.type === 'floating') return 'Servicio';
  if (product.type === 'integrated') {
    const combos = getAvailability(product, catalog);
    return `${combos} combo${combos === 1 ? '' : 's'} disponible${combos === 1 ? '' : 's'}`;
  }
  return `${product.stock} ${product.unit}`;
}

export function nextSequence(prefix: string, existing: string[], size = 5): string {
  const max = existing.reduce((acc, value) => {
    if (!value.startsWith(`${prefix}-`)) return acc;
    const parsed = Number.parseInt(value.replace(`${prefix}-`, ''), 10);
    return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(size, '0')}`;
}
