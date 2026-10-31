import { create } from 'zustand';
import type { Expense, Purchase, PurchaseLine, Supplier } from '@/types';
import { useAuditStore } from '@/store/useAuditStore';
import { useCashStore } from '@/store/useCashStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { round2, uid } from '@/utils/format';
import { getUnit, nextSequence } from '@/utils/product';

export interface PurchaseLineInput {
  productId: string;
  quantity: number;
  unitId: string;
  unitCost: number;
}

export interface CreatePurchaseInput {
  supplierId: string;
  items: PurchaseLineInput[];
  paymentMethod: 'cash' | 'credit' | 'transfer';
  isCashDrawerExpense: boolean;
  invoiceRef: string;
  notes: string;
}

export interface CreateExpenseInput {
  supplierId: string;
  concept: string;
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'credit' | 'transfer';
  isCashDrawerExpense: boolean;
  invoiceRef: string;
}

interface PurchaseState {
  purchases: Purchase[];
  expenses: Expense[];
  setPurchases: (purchases: Purchase[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  createPurchase: (input: CreatePurchaseInput) => Purchase;
  createExpense: (input: CreateExpenseInput) => Expense;
  voidPurchase: (id: string, reason: string) => Purchase;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  purchases: [],
  expenses: [],

  setPurchases: (purchases) => set({ purchases }),
  setExpenses: (expenses) => set({ expenses }),

  createPurchase: (input) => {
    if (input.items.length === 0) throw new Error('Agrega al menos una línea de compra.');
    const settingsState = useSettingsStore.getState();
    const catalog = useCatalogStore.getState();
    const cash = useCashStore.getState();
    const user = settingsState.currentUser;
    const supplier = catalog.suppliers.find((entry) => entry.id === input.supplierId);
    if (!supplier) throw new Error('Selecciona un proveedor válido.');
    if (supplier.type !== 'purchase') {
      throw new Error('El proveedor seleccionado es de gastos, no de inventario.');
    }

    const lines: PurchaseLine[] = input.items.map((line) => {
      const product = catalog.products.find((entry) => entry.id === line.productId);
      if (!product) throw new Error('Producto de compra no encontrado.');
      if (product.type === 'floating' || product.type === 'integrated') {
        throw new Error(`${product.name} no maneja stock físico comprable.`);
      }
      const unit = getUnit(product, line.unitId);
      if (line.quantity <= 0) throw new Error(`Cantidad inválida en ${product.name}.`);
      return {
        productId: product.id,
        name: product.name,
        unitId: unit.id,
        unitLabel: unit.name,
        quantity: line.quantity,
        unitCost: round2(line.unitCost),
        total: round2(line.quantity * line.unitCost),
      };
    });

    const subtotal = round2(lines.reduce((acc, line) => acc + line.total, 0));
    const total = subtotal;

    if (input.isCashDrawerExpense && input.paymentMethod !== 'cash') {
      throw new Error('Solo los pagos en efectivo pueden afectar la caja.');
    }

    if (input.isCashDrawerExpense) {
      if (!cash.current) throw new Error('No hay una caja abierta para afectar el efectivo.');
      if (cash.current) {
        const available = cash.current.initialAmount +
          cash.current.movements.reduce((acc, movement) => acc + movement.amount, 0);
        if (available + 0.01 < total) {
          throw new Error('No hay suficiente efectivo en caja para esta compra.');
        }
      }
    }

    const number = nextSequence(
      settingsState.settings.purchasePrefix,
      get().purchases.map((purchase) => purchase.number),
      4,
    );

    const purchase: Purchase = {
      id: uid('purchase'),
      number,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: lines,
      subtotal,
      tax: 0,
      total,
      paymentMethod: input.paymentMethod,
      isCashDrawerExpense: input.isCashDrawerExpense,
      invoiceRef: input.invoiceRef,
      notes: input.notes,
      userId: user.id,
      userName: user.name,
      createdAt: new Date().toISOString(),
    };

    catalog.receivePurchaseStock(
      lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitId: line.unitId,
        unitCost: line.unitCost,
      })),
    );
    updateSupplierBalance(catalog, supplier, input.paymentMethod === 'credit' ? total : 0);

    if (input.isCashDrawerExpense) {
      cash.addMovement({
        type: 'purchase',
        amount: -total,
        concept: `Compra ${number} · ${supplier.name}`,
        reference: number,
        userName: user.name,
      });
    }

    set((state) => ({ purchases: [purchase, ...state.purchases] }));

    useAuditStore.getState().addLog({
      action: 'purchase_created',
      entity: 'Compra',
      entityId: purchase.id,
      description: `${number} registrada con ${supplier.name} por C$ ${total.toFixed(2)}.`,
      userId: user.id,
      userName: user.name,
      metadata: {
        total,
        lineas: lines.length,
        caja: input.isCashDrawerExpense,
        pago: input.paymentMethod,
      },
    });

    return purchase;
  },

  createExpense: (input) => {
    if (!input.concept.trim()) throw new Error('Describe el concepto del gasto.');
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('El monto del gasto debe ser mayor que cero.');
    }
    const settingsState = useSettingsStore.getState();
    const catalog = useCatalogStore.getState();
    const cash = useCashStore.getState();
    const user = settingsState.currentUser;
    const supplier = catalog.suppliers.find((entry) => entry.id === input.supplierId);
    if (!supplier) throw new Error('Selecciona un proveedor de gastos válido.');
    if (supplier.type === 'purchase') {
      throw new Error('Un proveedor de inventario no puede registrarse como gasto.');
    }

    if (input.isCashDrawerExpense && input.paymentMethod !== 'cash') {
      throw new Error('Solo los pagos en efectivo pueden afectar la caja.');
    }

    if (input.isCashDrawerExpense) {
      if (!cash.current) throw new Error('No hay una caja abierta para afectar el efectivo.');
      const available = cash.current.initialAmount +
        cash.current.movements.reduce((acc, movement) => acc + movement.amount, 0);
      if (available + 0.01 < input.amount) {
        throw new Error('No hay suficiente efectivo en caja para este gasto.');
      }
    }

    const number = nextSequence(
      settingsState.settings.expensePrefix,
      get().expenses.map((expense) => expense.number),
      4,
    );

    const expense: Expense = {
      id: uid('expense'),
      number,
      supplierId: supplier.id,
      supplierName: supplier.name,
      concept: input.concept.trim(),
      category: input.category,
      amount: round2(input.amount),
      paymentMethod: input.paymentMethod,
      isCashDrawerExpense: input.isCashDrawerExpense,
      invoiceRef: input.invoiceRef,
      createdAt: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
    };

    if (input.isCashDrawerExpense) {
      cash.addMovement({
        type: 'expense',
        amount: -expense.amount,
        concept: `${number} · ${expense.concept}`,
        reference: number,
        userName: user.name,
      });
    }

    if (input.paymentMethod === 'credit') {
      catalog.increaseSupplierBalance(supplier.id, expense.amount);
    }

    set((state) => ({ expenses: [expense, ...state.expenses] }));
    useAuditStore.getState().addLog({
      action: 'expense_created',
      entity: 'Gasto',
      entityId: expense.id,
      description: `${number} registrado por C$ ${expense.amount.toFixed(2)} · ${expense.concept}.`,
      userId: user.id,
      userName: user.name,
      metadata: { monto: expense.amount, caja: input.isCashDrawerExpense, categoria: expense.category },
    });
    return expense;
  },

  voidPurchase: (id, reason) => {
    const purchase = get().purchases.find((p) => p.id === id);
    if (!purchase) throw new Error('Compra no encontrada.');
    if (purchase.voided) throw new Error('Esta compra ya fue anulada.');

    const settingsState = useSettingsStore.getState();
    const catalog = useCatalogStore.getState();
    const cash = useCashStore.getState();
    const user = settingsState.currentUser;

    // Revert stock
    for (const line of purchase.items) {
      const product = catalog.products.find((p) => p.id === line.productId);
      if (!product) continue;
      const unit = getUnit(product, line.unitId);
      const baseQty = line.quantity * (unit.ratio || 1);
      catalog.adjustStockAbsolute(product.id, Math.max(0, round2(product.stock - baseQty)));
    }

    // Revert supplier balance if credit
    if (purchase.paymentMethod === 'credit') {
      catalog.decreaseSupplierBalance(purchase.supplierId, purchase.total);
    }

    // Revert cash if affected drawer
    if (purchase.isCashDrawerExpense) {
      cash.addMovement({
        type: 'deposit',
        amount: purchase.total,
        concept: `Anulación de compra ${purchase.number}`,
        reference: purchase.number,
        userName: user.name,
      });
    }

    const updated: Purchase = {
      ...purchase,
      voided: true,
      voidedAt: new Date().toISOString(),
      voidReason: reason.trim(),
    };

    set((state) => ({
      purchases: state.purchases.map((p) => (p.id === id ? updated : p)),
    }));

    useAuditStore.getState().addLog({
      action: 'purchase_created',
      entity: 'Compra',
      entityId: purchase.id,
      description: `Compra ${purchase.number} anulada por ${user.name}: ${reason.trim()}.`,
      severity: 'critical',
      userId: user.id,
      userName: user.name,
      metadata: { total: purchase.total, motivo: reason.trim() },
    });

    return updated;
  },
}));

function updateSupplierBalance(
  catalog: ReturnType<typeof useCatalogStore.getState>,
  supplier: Supplier,
  amount: number,
): void {
  if (amount <= 0) return;
  catalog.increaseSupplierBalance(supplier.id, amount);
}
