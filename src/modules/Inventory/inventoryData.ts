/* ------------------------------------------------------------------ *
 * Inventory traceability helpers.
 * No mock history is generated: movements come from real adjustments
 * and, once the backend is connected, from inventory endpoints.
 * ------------------------------------------------------------------ */

import type { Product, StockAdjustment } from '@/types';

export type KardexMovementType = 'initial' | 'purchase' | 'sale' | 'adjustment' | 'return';

export type LotStatus = 'valid' | 'expiring' | 'expired';

export type SerialStatus = 'in_stock' | 'sold' | 'returned';

export interface KardexLot {
  code: string;
  expiresAt: string;
  status: LotStatus;
  daysLeft: number;
}

export interface KardexSerial {
  code: string;
  status: SerialStatus;
}

export interface KardexMovement {
  id: string;
  productId: string;
  type: KardexMovementType;
  reference: string;
  description: string;
  /** Signed quantity: positive = entry, negative = exit. */
  quantity: number;
  /** Resulting balance after this movement. */
  balance: number;
  unit: string;
  user: string;
  channel: 'Bodega' | 'Compras' | 'POS' | 'Auditoría';
  createdAt: string;
  lot?: KardexLot;
  serials?: KardexSerial[];
}

export const MOVEMENT_META: Record<
  KardexMovementType,
  { label: string; badge: string; dot: string; description: string }
> = {
  initial: {
    label: 'Carga inicial',
    badge: 'border-info/25 bg-info/10 text-info',
    dot: 'bg-info',
    description: 'Apertura de inventario en bodega.',
  },
  purchase: {
    label: 'Compra',
    badge: 'border-success/25 bg-success/10 text-success',
    dot: 'bg-success',
    description: 'Entrada recibida por compra a proveedor.',
  },
  sale: {
    label: 'Venta',
    badge: 'border-primary/25 bg-primary/10 text-primary',
    dot: 'bg-primary',
    description: 'Salida descontada desde el punto de venta.',
  },
  adjustment: {
    label: 'Ajuste absoluto',
    badge: 'border-warning/25 bg-warning/10 text-warning',
    dot: 'bg-warning',
    description: 'Reemplazo físico auditado por conteo o incidencia.',
  },
  return: {
    label: 'Devolución',
    badge: 'border-primary/25 bg-primary/10 text-primary',
    dot: 'bg-primary',
    description: 'Reingreso de mercancía devuelta por el cliente.',
  },
};

/**
 * Categorías que operativamente manejan lotes/vencimientos.
 * El backend puede reemplazar esta regla por una bandera propia del producto.
 */
export function isLotTracked(product: Product): boolean {
  return product.category === 'Lácteos' || product.category === 'Panadería';
}

/**
 * El control por serial aún no forma parte del contrato de producto.
 * Se deja desactivado hasta que el backend exponga ese campo.
 */
export function isSerialTracked(_product: Product): boolean {
  return false;
}

export function buildKardex(product: Product, adjustments: StockAdjustment[]): KardexMovement[] {
  return adjustments
    .filter((adjustment) => adjustment.productId === product.id)
    .map((adjustment) => ({
      id: `live-${adjustment.id}`,
      productId: product.id,
      type: 'adjustment' as const,
      reference: `AJU-${adjustment.id.slice(-5).toUpperCase()}`,
      description: `Reemplazo absoluto · ${adjustment.reason}`,
      quantity: adjustment.difference,
      balance: adjustment.newStock,
      unit: adjustment.unit,
      user: adjustment.issuer,
      channel: 'Auditoría' as const,
      createdAt: adjustment.createdAt,
    }))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export interface TraceabilitySummary {
  lots: KardexLot[];
  serials: KardexSerial[];
  expiringLots: number;
  expiredLots: number;
  serialsInStock: number;
}

export function collectTraceability(movements: KardexMovement[]): TraceabilitySummary {
  const lotMap = new Map<string, KardexLot>();
  const serialMap = new Map<string, KardexSerial>();

  for (const movement of movements) {
    if (movement.lot && !lotMap.has(movement.lot.code)) lotMap.set(movement.lot.code, movement.lot);
    for (const serial of movement.serials ?? []) {
      if (!serialMap.has(serial.code)) serialMap.set(serial.code, serial);
    }
  }

  const lots = [...lotMap.values()];
  const serials = [...serialMap.values()];

  return {
    lots,
    serials,
    expiringLots: lots.filter((lot) => lot.status === 'expiring').length,
    expiredLots: lots.filter((lot) => lot.status === 'expired').length,
    serialsInStock: serials.filter((serial) => serial.status === 'in_stock').length,
  };
}

export function expiryLabel(lot: KardexLot): string {
  if (lot.status === 'expired') return `Vencido hace ${Math.abs(lot.daysLeft)} d`;
  if (lot.daysLeft === 0) return 'Vence hoy';
  if (lot.daysLeft === 1) return 'Vence mañana';
  return `Vence en ${lot.daysLeft} d`;
}
