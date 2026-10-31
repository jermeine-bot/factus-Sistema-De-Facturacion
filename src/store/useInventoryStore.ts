import { create } from 'zustand';
import type { StockAdjustment } from '@/types';
import { useAuditStore } from '@/store/useAuditStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { round2, uid } from '@/utils/format';

interface AdjustmentInput {
  productId: string;
  newStock: number;
  reason: string;
  issuer: string;
}

interface InventoryState {
  adjustments: StockAdjustment[];
  setAdjustments: (adjustments: StockAdjustment[]) => void;
  recordAdjustment: (input: AdjustmentInput) => StockAdjustment;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  adjustments: [],

  setAdjustments: (adjustments) => set({ adjustments }),

  recordAdjustment: ({ productId, newStock, reason, issuer }) => {
    const catalog = useCatalogStore.getState();
    const product = catalog.products.find((entry) => entry.id === productId);
    if (!product) throw new Error('Producto no encontrado.');
    if (!issuer.trim()) throw new Error('Indica el nombre de quien autoriza el ajuste.');
    if (!reason.trim()) throw new Error('Describe el motivo del ajuste de inventario.');
    if (!Number.isFinite(newStock) || newStock < 0) {
      throw new Error('El stock absoluto debe ser un número mayor o igual a cero.');
    }

    const previousStock = product.stock;
    const difference = round2(newStock - previousStock);
    catalog.adjustStockAbsolute(product.id, newStock);

    const adjustment: StockAdjustment = {
      id: uid('adj'),
      productId: product.id,
      productName: product.name,
      previousStock,
      newStock: round2(newStock),
      difference,
      unit: product.unit,
      reason: reason.trim(),
      issuer: issuer.trim(),
      createdAt: new Date().toISOString(),
    };

    set((state) => ({ adjustments: [adjustment, ...state.adjustments] }));

    const user = useSettingsStore.getState().currentUser;
    useAuditStore.getState().addLog({
      action: 'stock_adjusted',
      entity: 'Producto',
      entityId: product.id,
      description: `Ajuste absoluto de ${product.name}: ${previousStock} → ${round2(newStock)} ${product.unit}. Autoriza ${issuer.trim()}.`,
      severity: 'critical',
      userId: user.id,
      userName: user.name,
      metadata: {
        anterior: previousStock,
        nuevo: round2(newStock),
        diferencia: difference,
        motivo: reason.trim(),
        autoriza: issuer.trim(),
      },
    });

    return adjustment;
  },
}));
