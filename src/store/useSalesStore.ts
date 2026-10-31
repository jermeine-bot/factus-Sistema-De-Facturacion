import { create } from 'zustand';
import type { CartItem, CreditNote, Currency, PaymentSplit, Proforma, Sale, SaleItem } from '@/types';
import { useAuditStore } from '@/store/useAuditStore';
import { useCashStore } from '@/store/useCashStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { computeLineTotal, computeTotals, round2, uid } from '@/utils/format';
import { nextSequence, saleItemFromCart } from '@/utils/product';

export interface CreateSaleInput {
  items: CartItem[];
  payments: PaymentSplit[];
  change: number;
  currency: Currency;
  exchangeRate: number;
  customerId: string | null;
  notes: string;
  proformaId?: string | null;
}

interface CreateProformaInput {
  items: CartItem[];
  customerId: string | null;
  notes: string;
  validDays?: number;
}

interface SalesState {
  sales: Sale[];
  proformas: Proforma[];
  createSale: (input: CreateSaleInput) => Sale;
  createProforma: (input: CreateProformaInput) => Proforma;
  voidSale: (id: string) => void;
  creditNotes: CreditNote[];
  createCreditNote: (saleId: string, reason: string) => CreditNote;
  setSales: (sales: Sale[]) => void;
  setProformas: (proformas: Proforma[]) => void;
  setCreditNotes: (notes: CreditNote[]) => void;
}

function toSaleItems(items: CartItem[], products: ReturnType<typeof useCatalogStore.getState>['products']): SaleItem[] {
  return items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const unit = product?.units.find((entry) => entry.id === item.unitId) ?? product?.units[0];
    const line = computeLineTotal(item.quantity, item.unitPrice, item.discount);
    return saleItemFromCart(item, line.total, unit?.ratio ?? 1);
  });
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  proformas: [],
  creditNotes: [],

  setSales: (sales) => set({ sales }),
  setProformas: (proformas) => set({ proformas }),
  setCreditNotes: (creditNotes) => set({ creditNotes }),

  createCreditNote: (saleId, reason) => {
    const sale = get().sales.find((entry) => entry.id === saleId);
    if (!sale || sale.status !== 'completed') throw new Error('La factura no está disponible para devolución.');
    if (get().creditNotes.some((note) => note.saleId === saleId)) throw new Error('Esta factura ya tiene una nota de crédito.');
    if (!reason.trim()) throw new Error('Indica el motivo de la devolución.');
    const user = useSettingsStore.getState().currentUser;
    const number = nextSequence('NC-', get().creditNotes.map((note) => note.number), 4);
    const cashAmount = round2(sale.payments.filter((payment) => payment.method === 'cash').reduce((sum, payment) => sum + payment.amount, 0));
    const cash = useCashStore.getState();
    if (cashAmount > 0 && !cash.current) throw new Error('Abre caja para registrar el reembolso en efectivo.');
    useCatalogStore.getState().restoreSaleStock(sale.items);
    const creditAmount = round2(sale.payments.filter((payment) => payment.method === 'credit').reduce((sum, payment) => sum + payment.amount, 0));
    if (sale.customerId && creditAmount > 0) useCatalogStore.getState().decreaseCustomerBalance(sale.customerId, creditAmount);
    if (cashAmount > 0) cash.addMovement({ type: 'withdrawal', amount: -cashAmount, concept: `Reembolso ${number} · ${sale.invoiceNumber}`, reference: number, userName: user.name });
    const note: CreditNote = { id: uid('cn'), number, saleId, invoiceNumber: sale.invoiceNumber, total: sale.totals.total, reason: reason.trim(), userId: user.id, userName: user.name, createdAt: new Date().toISOString() };
    set((state) => ({ creditNotes: [note, ...state.creditNotes] }));
    useAuditStore.getState().addLog({ action: 'credit_note_created', entity: 'Nota de crédito', entityId: note.id, description: `${number} emitida para ${sale.invoiceNumber} por C$ ${note.total.toFixed(2)}.`, severity: 'critical', userId: user.id, userName: user.name, metadata: { total: note.total, efectivo: cashAmount, creditoRevertido: creditAmount, factura: sale.invoiceNumber } });
    return note;
  },

  createSale: (input) => {
    if (input.items.length === 0) throw new Error('Agrega al menos un producto a la venta.');

    const settingsState = useSettingsStore.getState();
    const catalog = useCatalogStore.getState();
    const cash = useCashStore.getState();
    const audit = useAuditStore.getState();
    const user = settingsState.currentUser;

    const stockErrors = catalog.validateCartStock(input.items);
    if (stockErrors.length > 0) throw new Error(stockErrors[0]);

    const saleItems = toSaleItems(input.items, catalog.products);
    const totals = computeTotals(
      input.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        unitCost: item.unitCost,
      })),
    );

    const payments = input.payments.filter((payment) => payment.amount > 0);
    if (payments.length === 0) throw new Error('Registra al menos un método de pago.');

    const paid = round2(payments.reduce((acc, payment) => acc + payment.amount, 0));
    if (Math.abs(paid - totals.total) > 0.05) {
      throw new Error('El monto de los pagos no coincide con el total de la venta.');
    }

    const creditAmount = round2(
      payments.filter((payment) => payment.method === 'credit').reduce((acc, payment) => acc + payment.amount, 0),
    );
    const customer = input.customerId
      ? catalog.customers.find((entry) => entry.id === input.customerId) ?? null
      : null;

    if (creditAmount > 0) {
      if (!customer) throw new Error('Selecciona un cliente para registrar una venta a crédito.');
      const projected = round2(customer.balance + creditAmount);
      if (projected > customer.creditLimit + 0.01) {
        audit.addLog({
          action: 'credit_limit_blocked',
          entity: 'Cliente',
          entityId: customer.id,
          description: `Venta a crédito bloqueada para ${customer.name}: excede el límite en C$ ${round2(projected - customer.creditLimit).toFixed(2)}.`,
          severity: 'critical',
          userId: user.id,
          userName: user.name,
          metadata: {
            limite: customer.creditLimit,
            saldo: customer.balance,
            intento: creditAmount,
          },
        });
        throw new Error(
          `Límite de crédito excedido. Disponible: C$ ${round2(customer.creditLimit - customer.balance).toFixed(2)}.`,
        );
      }
    }

    const cashPortion = round2(
      payments.filter((payment) => payment.method === 'cash').reduce((acc, payment) => acc + payment.amount, 0),
    );

    if (cashPortion > 0 && settingsState.settings.cashDrawerRequired && !cash.current) {
      throw new Error('Debes abrir la caja para registrar ventas en efectivo.');
    }

    const invoiceNumber = nextSequence(
      settingsState.settings.invoicePrefix,
      get().sales.map((sale) => sale.invoiceNumber),
    );

    const sale: Sale = {
      id: uid('sale'),
      invoiceNumber,
      items: saleItems,
      totals,
      payments,
      change: round2(Math.max(0, input.change)),
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? 'Consumidor Final',
      userId: user.id,
      userName: user.name,
      status: 'completed',
      isCashDrawer: cashPortion > 0,
      notes: input.notes,
      proformaId: input.proformaId ?? null,
      createdAt: new Date().toISOString(),
    };

    catalog.applySaleStock(input.items);
    if (customer && creditAmount > 0) catalog.increaseCustomerBalance(customer.id, creditAmount);

    if (cashPortion > 0) {
      cash.addMovement({
        type: 'sale',
        amount: cashPortion,
        concept: `Venta ${invoiceNumber} · ${saleItems.map((item) => item.name).join(', ')}`,
        reference: invoiceNumber,
        userName: user.name,
      });
    }

    audit.addLog({
      action: 'sale_completed',
      entity: 'Venta',
      entityId: sale.id,
      description: `${invoiceNumber} registrada por C$ ${totals.total.toFixed(2)} · ${sale.customerName}.`,
      severity: 'info',
      userId: user.id,
      userName: user.name,
      metadata: {
        total: totals.total,
        moneda: input.currency,
        metodo: payments.map((payment) => payment.method).join('+'),
        credito: creditAmount,
      },
    });

    if (input.proformaId) {
      const proforma = get().proformas.find((entry) => entry.id === input.proformaId);
      set((state) => ({
        proformas: state.proformas.map((entry) =>
          entry.id === input.proformaId
            ? { ...entry, status: 'converted', convertedSaleId: sale.id }
            : entry,
        ),
      }));
      if (proforma) {
        audit.addLog({
          action: 'proforma_converted',
          entity: 'Proforma',
          entityId: proforma.id,
          description: `${proforma.number} convertida a la venta ${invoiceNumber}.`,
          userId: user.id,
          userName: user.name,
          metadata: { total: totals.total },
        });
      }
    }

    set((state) => ({ sales: [sale, ...state.sales] }));
    return sale;
  },

  createProforma: (input) => {
    if (input.items.length === 0) throw new Error('Agrega al menos un producto a la cotización.');
    const settingsState = useSettingsStore.getState();
    const catalog = useCatalogStore.getState();
    const user = settingsState.currentUser;
    const totals = computeTotals(
      input.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        unitCost: item.unitCost,
      })),
    );
    const number = nextSequence(
      settingsState.settings.proformaPrefix,
      get().proformas.map((proforma) => proforma.number),
      4,
    );
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (input.validDays ?? 7));
    const customer = input.customerId
      ? catalog.customers.find((entry) => entry.id === input.customerId) ?? null
      : null;
    const proforma: Proforma = {
      id: uid('proforma'),
      number,
      items: input.items,
      totals,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? 'Consumidor Final',
      userId: user.id,
      userName: user.name,
      status: 'open',
      validUntil: validUntil.toISOString(),
      notes: input.notes,
      createdAt: new Date().toISOString(),
      convertedSaleId: null,
    };
    set((state) => ({ proformas: [proforma, ...state.proformas] }));
    useAuditStore.getState().addLog({
      action: 'proforma_created',
      entity: 'Proforma',
      entityId: proforma.id,
      description: `${number} creada por C$ ${totals.total.toFixed(2)} · ${proforma.customerName}.`,
      userId: user.id,
      userName: user.name,
      metadata: { total: totals.total, vigencia: validUntil.toISOString() },
    });
    return proforma;
  },

  voidSale: (id) => {
    const sale = get().sales.find((entry) => entry.id === id);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status === 'void') throw new Error('Esta venta ya fue anulada.');
    const user = useSettingsStore.getState().currentUser;
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      throw new Error('Solo un administrador o supervisor puede anular ventas.');
    }

    useCatalogStore.getState().restoreSaleStock(sale.items);

    const creditAmount = round2(
      sale.payments
        .filter((payment) => payment.method === 'credit')
        .reduce((acc, payment) => acc + payment.amount, 0),
    );
    if (sale.customerId && creditAmount > 0) {
      useCatalogStore.getState().decreaseCustomerBalance(sale.customerId, creditAmount);
    }

    const cashAmount = round2(
      sale.payments
        .filter((payment) => payment.method === 'cash')
        .reduce((acc, payment) => acc + payment.amount, 0),
    );
    if (cashAmount > 0) {
      useCashStore.getState().addMovement({
        type: 'withdrawal',
        amount: -cashAmount,
        concept: `Anulación de venta ${sale.invoiceNumber}`,
        reference: sale.invoiceNumber,
        userName: user.name,
      });
    }

    set((state) => ({
      sales: state.sales.map((entry) =>
        entry.id === id ? { ...entry, status: 'void' } : entry,
      ),
    }));

    useAuditStore.getState().addLog({
      action: 'sale_voided',
      entity: 'Venta',
      entityId: sale.id,
      description: `${sale.invoiceNumber} fue anulada por ${user.name}. Inventario y crédito revertidos.`,
      severity: 'critical',
      userId: user.id,
      userName: user.name,
      metadata: { total: sale.totals.total, efectivo: cashAmount, credito: creditAmount },
    });
  },
}));
