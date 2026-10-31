import { create } from 'zustand';
import type { CartItem, Currency, Product, Proforma } from '@/types';
import { useCatalogStore } from '@/store/useCatalogStore';
import { cartItemFromProduct, getUnitAvailability } from '@/utils/product';
import { round2, uid } from '@/utils/format';

interface POSState {
  items: CartItem[];
  customerId: string | null;
  currency: Currency;
  notes: string;
  proformaId: string | null;
  addProduct: (product: Product, unitId: string, quantity?: number) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updatePrice: (lineId: string, price: number) => void;
  updateDiscount: (lineId: string, discount: number) => void;
  updateDescription: (lineId: string, description: string) => void;
  removeItem: (lineId: string) => void;
  setCustomer: (customerId: string | null) => void;
  setCurrency: (currency: Currency) => void;
  setNotes: (notes: string) => void;
  loadProforma: (proforma: Proforma) => void;
  detachProforma: () => void;
  clear: () => void;
}

export const usePOSStore = create<POSState>((set, get) => ({
  items: [],
  customerId: null,
  currency: 'NIO',
  notes: '',
  proformaId: null,

  addProduct: (product, unitId, quantity = 1) => {
    const catalog = useCatalogStore.getState().products;
    const lineId = `${product.id}:${unitId}`;
    const existing = get().items.find((item) => item.lineId === lineId);
    const nextQuantity = round2((existing?.quantity ?? 0) + quantity);
    const available = getUnitAvailability(product, unitId, catalog);
    if (nextQuantity > available) {
      throw new Error(
        product.type === 'integrated'
          ? `Solo hay ${available} combo(s) disponibles según sus componentes.`
          : `Stock insuficiente: quedan ${available} ${product.unit} de ${product.name}.`,
      );
    }
    if (existing) {
      set((state) => ({
        items: state.items.map((item) =>
          item.lineId === lineId ? { ...item, quantity: nextQuantity } : item,
        ),
      }));
      return;
    }
    const item = cartItemFromProduct(product, unitId, lineId, quantity);
    set((state) => ({ items: [...state.items, item] }));
  },

  updateQuantity: (lineId, quantity) => {
    const item = get().items.find((entry) => entry.lineId === lineId);
    if (!item) return;
    if (quantity <= 0) {
      set((state) => ({ items: state.items.filter((entry) => entry.lineId !== lineId) }));
      return;
    }
    if (item.type !== 'floating') {
      const product = useCatalogStore.getState().products.find((entry) => entry.id === item.productId);
      if (product) {
        const available = getUnitAvailability(
          product,
          item.unitId,
          useCatalogStore.getState().products,
        );
        if (quantity > available) {
          throw new Error(`Stock insuficiente. Disponible: ${available} ${product.unit}.`);
        }
      }
    }
    set((state) => ({
      items: state.items.map((entry) =>
        entry.lineId === lineId ? { ...entry, quantity: round2(quantity) } : entry,
      ),
    }));
  },

  updatePrice: (lineId, price) => {
    const item = get().items.find((entry) => entry.lineId === lineId);
    if (!item) return;
    if (item.type !== 'floating') {
      throw new Error('Solo los servicios de precio libre permiten editar el precio en venta.');
    }
    if (!Number.isFinite(price) || price < 0) throw new Error('Precio inválido.');
    set((state) => ({
      items: state.items.map((entry) =>
        entry.lineId === lineId ? { ...entry, unitPrice: round2(price) } : entry,
      ),
    }));
  },

  updateDiscount: (lineId, discount) => {
    const safe = Math.min(100, Math.max(0, discount));
    set((state) => ({
      items: state.items.map((entry) =>
        entry.lineId === lineId ? { ...entry, discount: round2(safe) } : entry,
      ),
    }));
  },

  updateDescription: (lineId, description) => {
    const item = get().items.find((entry) => entry.lineId === lineId);
    if (!item || item.type !== 'floating') return;
    set((state) => ({
      items: state.items.map((entry) =>
        entry.lineId === lineId ? { ...entry, description } : entry,
      ),
    }));
  },

  removeItem: (lineId) => {
    set((state) => ({ items: state.items.filter((entry) => entry.lineId !== lineId) }));
  },

  setCustomer: (customerId) => set({ customerId }),

  setCurrency: (currency) => set({ currency }),

  setNotes: (notes) => set({ notes }),

  loadProforma: (proforma) => {
    const items = proforma.items.map((item) => ({
      ...item,
      lineId: `${item.productId}:${item.unitId}:${uid('line')}`,
    }));
    set({
      items,
      customerId: proforma.customerId,
      notes: proforma.notes,
      proformaId: proforma.id,
      currency: 'NIO',
    });
  },

  detachProforma: () => set({ proformaId: null }),

  clear: () =>
    set({
      items: [],
      customerId: null,
      notes: '',
      proformaId: null,
    }),
}));
