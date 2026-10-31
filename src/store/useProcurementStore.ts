import { create } from 'zustand';
import type { PurchaseLine, PurchaseOrder, SupplierPayment } from '@/types';
import { useAuditStore } from '@/store/useAuditStore';
import { useCashStore } from '@/store/useCashStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { round2, uid } from '@/utils/format';
import { nextSequence } from '@/utils/product';

export interface PurchaseOrderLineInput {
  productId: string;
  quantity: number;
  unitId: string;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  items: PurchaseOrderLineInput[];
  expectedDate: string;
  invoiceRef: string;
  notes: string;
}

export interface SupplierPaymentInput {
  supplierId: string;
  amount: number;
  method: 'cash' | 'transfer';
  reference: string;
  notes: string;
}

interface ProcurementState {
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  setPurchaseOrders: (orders: PurchaseOrder[]) => void;
  setSupplierPayments: (payments: SupplierPayment[]) => void;
  createPurchaseOrder: (input: CreatePurchaseOrderInput) => PurchaseOrder;
  receivePurchaseOrder: (id: string) => PurchaseOrder;
  cancelPurchaseOrder: (id: string) => PurchaseOrder;
  registerSupplierPayment: (input: SupplierPaymentInput) => SupplierPayment;
}

export const useProcurementStore = create<ProcurementState>((set, get) => ({
  purchaseOrders: [],
  supplierPayments: [],

  setPurchaseOrders: (purchaseOrders) => set({ purchaseOrders }),
  setSupplierPayments: (supplierPayments) => set({ supplierPayments }),

  createPurchaseOrder: (input) => {
    if (input.items.length === 0) throw new Error('Agrega al menos una línea a la orden.');
    if (!input.expectedDate) throw new Error('Indica la fecha esperada de entrega.');
    const catalog = useCatalogStore.getState();
    const settingsState = useSettingsStore.getState();
    const supplier = catalog.suppliers.find((entry) => entry.id === input.supplierId);
    if (!supplier) throw new Error('Selecciona un proveedor válido.');
    if (supplier.type !== 'purchase') throw new Error('La orden requiere un proveedor de inventario.');

    const items: PurchaseLine[] = input.items.map((line) => {
      const product = catalog.products.find((entry) => entry.id === line.productId);
      if (!product) throw new Error('Producto de compra no encontrado.');
      const unit = product.units.find((entry) => entry.id === line.unitId) ?? product.units[0];
      if (line.quantity <= 0) throw new Error(`Cantidad inválida en ${product.name}.`);
      if (line.unitCost < 0) throw new Error(`Costo inválido en ${product.name}.`);
      return {
        productId: product.id,
        name: product.name,
        unitId: unit.id,
        unitLabel: unit.name,
        quantity: round2(line.quantity),
        unitCost: round2(line.unitCost),
        total: round2(line.quantity * line.unitCost),
      };
    });
    const subtotal = round2(items.reduce((acc, line) => acc + line.total, 0));
    const number = nextSequence(
      'OC',
      get().purchaseOrders.map((order) => order.number),
      4,
    );
    const user = settingsState.currentUser;
    const order: PurchaseOrder = {
      id: uid('po'),
      number,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items,
      subtotal,
      tax: 0,
      total: subtotal,
      expectedDate: input.expectedDate,
      status: 'sent',
      invoiceRef: input.invoiceRef.trim(),
      notes: input.notes.trim(),
      userId: user.id,
      userName: user.name,
      createdAt: new Date().toISOString(),
      receivedAt: null,
    };
    set((state) => ({ purchaseOrders: [order, ...state.purchaseOrders] }));
    useAuditStore.getState().addLog({
      action: 'purchase_order_created',
      entity: 'Orden de compra',
      entityId: order.id,
      description: `${number} enviada a ${supplier.name} por C$ ${order.total.toFixed(2)}.`,
      userId: user.id,
      userName: user.name,
      metadata: { total: order.total, lineas: items.length, entrega: input.expectedDate },
    });
    return order;
  },

  receivePurchaseOrder: (id) => {
    const order = get().purchaseOrders.find((entry) => entry.id === id);
    if (!order) throw new Error('Orden de compra no encontrada.');
    if (order.status === 'received') return order;
    if (order.status === 'cancelled') throw new Error('Una orden cancelada no puede recibirse.');
    const user = useSettingsStore.getState().currentUser;
    const received: PurchaseOrder = {
      ...order,
      status: 'received',
      receivedAt: new Date().toISOString(),
    };
    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((entry) => (entry.id === id ? received : entry)),
    }));
    useAuditStore.getState().addLog({
      action: 'purchase_order_received',
      entity: 'Orden de compra',
      entityId: order.id,
      description: `${order.number} marcada como recibida. El stock se actualiza al registrar la factura.`,
      userId: user.id,
      userName: user.name,
      metadata: { total: order.total, proveedor: order.supplierName },
    });
    return received;
  },

  cancelPurchaseOrder: (id) => {
    const order = get().purchaseOrders.find((entry) => entry.id === id);
    if (!order) throw new Error('Orden de compra no encontrada.');
    if (order.status === 'received') throw new Error('Una orden recibida no puede cancelarse.');
    const user = useSettingsStore.getState().currentUser;
    const cancelled: PurchaseOrder = { ...order, status: 'cancelled' };
    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((entry) => (entry.id === id ? cancelled : entry)),
    }));
    useAuditStore.getState().addLog({
      action: 'purchase_order_received',
      entity: 'Orden de compra',
      entityId: order.id,
      description: `${order.number} cancelada.`,
      severity: 'warning',
      userId: user.id,
      userName: user.name,
    });
    return cancelled;
  },

  registerSupplierPayment: (input) => {
    const catalog = useCatalogStore.getState();
    const settingsState = useSettingsStore.getState();
    const supplier = catalog.suppliers.find((entry) => entry.id === input.supplierId);
    if (!supplier) throw new Error('Proveedor no encontrado.');
    if (input.amount <= 0) throw new Error('El abono debe ser mayor que cero.');
    if (input.amount > supplier.balance + 0.01) {
      throw new Error('El abono no puede superar el saldo pendiente del proveedor.');
    }
    if (input.method === 'cash') {
      const cash = useCashStore.getState();
      if (!cash.current) throw new Error('Abre la caja para registrar un abono en efectivo.');
      cash.addMovement({
        type: 'credit_payment',
        amount: -input.amount,
        concept: `Abono a ${supplier.name}`,
        reference: input.reference.trim() || 'ABONO-PROV',
        userName: settingsState.currentUser.name,
      });
    }
    const user = settingsState.currentUser;
    const payment: SupplierPayment = {
      id: uid('spay'),
      supplierId: supplier.id,
      supplierName: supplier.name,
      amount: round2(input.amount),
      method: input.method,
      reference: input.reference.trim(),
      notes: input.notes.trim(),
      userId: user.id,
      userName: user.name,
      createdAt: new Date().toISOString(),
    };
    catalog.decreaseSupplierBalance(supplier.id, payment.amount);
    set((state) => ({ supplierPayments: [payment, ...state.supplierPayments] }));
    useAuditStore.getState().addLog({
      action: 'supplier_payment',
      entity: 'Proveedor',
      entityId: supplier.id,
      description: `Abono de C$ ${payment.amount.toFixed(2)} registrado a ${supplier.name}.`,
      userId: user.id,
      userName: user.name,
      metadata: {
        monto: payment.amount,
        metodo: payment.method,
        saldoAnterior: supplier.balance,
        saldoNuevo: round2(supplier.balance - payment.amount),
      },
    });
    return payment;
  },
}));

export function supplierCreditDocuments(supplierId: string): Array<{
  number: string;
  total: number;
  createdAt: string;
}> {
  return usePurchaseStore
    .getState()
    .purchases.filter((purchase) => purchase.supplierId === supplierId && purchase.paymentMethod === 'credit')
    .map((purchase) => ({
      number: purchase.number,
      total: purchase.total,
      createdAt: purchase.createdAt,
    }));
}
