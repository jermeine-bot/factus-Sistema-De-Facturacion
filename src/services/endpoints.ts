/**
 * Definición centralizada de servicios y endpoints para conectar el backend con Factus.
 * El desarrollador backend debe implementar estas rutas REST con los contratos descritos.
 */

import { apiClient, tokenStorage } from './apiClient';
import type {
  AuditLog,
  CashMovement,
  CashSession,
  CatalogCategory,
  CreditNote,
  Customer,
  Expense,
  Product,
  ProductDraft,
  Proforma,
  Purchase,
  PurchaseOrder,
  Sale,
  Settings,
  StockAdjustment,
  Supplier,
  SupplierPayment,
  User,
} from '@/types';

// ==========================================
// 1. AUTENTICACIÓN & USUARIOS
// ==========================================
export const authService = {
  login: async (credentials: { email?: string; pin: string }): Promise<{ token: string; user: User }> => {
    const response = await apiClient.post<{ token: string; user: User }>('/auth/login', credentials);
    if (response?.token) {
      tokenStorage.set(response.token);
    }
    return response;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      tokenStorage.remove();
    }
  },

  getCurrentUser: (): Promise<User> => apiClient.get<User>('/auth/me'),

  getUsers: (): Promise<User[]> => apiClient.get<User[]>('/users'),

  createUser: (user: Partial<User>): Promise<User> => apiClient.post<User>('/users', user),

  updateUser: (id: string, user: Partial<User>): Promise<User> => apiClient.put<User>(`/users/${id}`, user),

  toggleUserActive: (id: string): Promise<User> => apiClient.patch<User>(`/users/${id}/toggle-active`),
};

// ==========================================
// 2. PRODUCTOS & INVENTARIO
// ==========================================
export const productsService = {
  getAll: (params?: { search?: string; category?: string; activeOnly?: boolean }): Promise<Product[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.activeOnly !== undefined) query.append('activeOnly', String(params.activeOnly));
    const qs = query.toString();
    return apiClient.get<Product[]>(`/products${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<Product> => apiClient.get<Product>(`/products/${id}`),

  create: (draft: ProductDraft): Promise<Product> => apiClient.post<Product>('/products', draft),

  update: (id: string, draft: ProductDraft): Promise<Product> => apiClient.put<Product>(`/products/${id}`, draft),

  delete: (id: string): Promise<void> => apiClient.delete(`/products/${id}`),

  adjustStock: (adjustment: {
    productId: string;
    newStock: number;
    reason: string;
    issuer: string;
  }): Promise<StockAdjustment> => apiClient.post<StockAdjustment>('/inventory/adjust', adjustment),

  getAdjustments: (): Promise<StockAdjustment[]> => apiClient.get<StockAdjustment[]>('/inventory/adjustments'),
};

// ==========================================
// 3. CATEGORÍAS
// ==========================================
export const categoriesService = {
  getAll: (): Promise<CatalogCategory[]> => apiClient.get<CatalogCategory[]>('/categories'),

  create: (category: { name: string; color: string }): Promise<CatalogCategory> =>
    apiClient.post<CatalogCategory>('/categories', category),

  update: (id: string, category: { name: string; color: string }): Promise<CatalogCategory> =>
    apiClient.put<CatalogCategory>(`/categories/${id}`, category),

  delete: (id: string): Promise<void> => apiClient.delete(`/categories/${id}`),
};

// ==========================================
// 4. CLIENTES
// ==========================================
export const customersService = {
  getAll: (search?: string): Promise<Customer[]> => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.get<Customer[]>(`/customers${qs}`);
  },

  getById: (id: string): Promise<Customer> => apiClient.get<Customer>(`/customers/${id}`),

  create: (customer: Partial<Customer>): Promise<Customer> => apiClient.post<Customer>('/customers', customer),

  update: (id: string, customer: Partial<Customer>): Promise<Customer> =>
    apiClient.put<Customer>(`/customers/${id}`, customer),

  adjustBalance: (id: string, amount: number, type: 'increase' | 'decrease'): Promise<Customer> =>
    apiClient.post<Customer>(`/customers/${id}/balance`, { amount, type }),
};

// ==========================================
// 5. PROVEEDORES
// ==========================================
export const suppliersService = {
  getAll: (search?: string): Promise<Supplier[]> => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.get<Supplier[]>(`/suppliers${qs}`);
  },

  getById: (id: string): Promise<Supplier> => apiClient.get<Supplier>(`/suppliers/${id}`),

  create: (supplier: Partial<Supplier>): Promise<Supplier> => apiClient.post<Supplier>('/suppliers', supplier),

  update: (id: string, supplier: Partial<Supplier>): Promise<Supplier> =>
    apiClient.put<Supplier>(`/suppliers/${id}`, supplier),

  registerPayment: (payment: {
    supplierId: string;
    amount: number;
    method: 'cash' | 'transfer';
    reference: string;
    notes: string;
  }): Promise<SupplierPayment> => apiClient.post<SupplierPayment>('/suppliers/payments', payment),

  getPayments: (): Promise<SupplierPayment[]> => apiClient.get<SupplierPayment[]>('/suppliers/payments'),
};

// ==========================================
// 6. VENTAS, POS Y FACTURACIÓN
// ==========================================
export const salesService = {
  getAll: (params?: { from?: string; to?: string; customerId?: string }): Promise<Sale[]> => {
    const query = new URLSearchParams();
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.customerId) query.append('customerId', params.customerId);
    const qs = query.toString();
    return apiClient.get<Sale[]>(`/sales${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<Sale> => apiClient.get<Sale>(`/sales/${id}`),

  create: (saleInput: unknown): Promise<Sale> => apiClient.post<Sale>('/sales', saleInput),

  voidSale: (id: string, reason: string): Promise<Sale> => apiClient.post<Sale>(`/sales/${id}/void`, { reason }),

  createCreditNote: (saleId: string, reason: string): Promise<CreditNote> =>
    apiClient.post<CreditNote>(`/sales/${saleId}/credit-note`, { reason }),
};

// ==========================================
// 7. PROFORMAS / COTIZACIONES
// ==========================================
export const proformasService = {
  getAll: (): Promise<Proforma[]> => apiClient.get<Proforma[]>('/proformas'),

  create: (proformaInput: unknown): Promise<Proforma> => apiClient.post<Proforma>('/proformas', proformaInput),

  convertToSale: (proformaId: string): Promise<Sale> => apiClient.post<Sale>(`/proformas/${proformaId}/convert`),
};

// ==========================================
// 8. COMPRAS, ORDENES Y GASTOS
// ==========================================
export const purchasesService = {
  getAll: (): Promise<Purchase[]> => apiClient.get<Purchase[]>('/purchases'),

  create: (purchaseInput: unknown): Promise<Purchase> => apiClient.post<Purchase>('/purchases', purchaseInput),

  cancel: (id: string, reason: string): Promise<Purchase> =>
    apiClient.post<Purchase>(`/purchases/${id}/cancel`, { reason }),

  getPurchaseOrders: (): Promise<PurchaseOrder[]> => apiClient.get<PurchaseOrder[]>('/purchases/orders'),

  createPurchaseOrder: (orderInput: unknown): Promise<PurchaseOrder> =>
    apiClient.post<PurchaseOrder>('/purchases/orders', orderInput),

  receivePurchaseOrder: (id: string): Promise<PurchaseOrder> =>
    apiClient.post<PurchaseOrder>(`/purchases/orders/${id}/receive`),
};

export const expensesService = {
  getAll: (): Promise<Expense[]> => apiClient.get<Expense[]>('/expenses'),

  create: (expenseInput: unknown): Promise<Expense> => apiClient.post<Expense>('/expenses', expenseInput),
};

// ==========================================
// 9. CAJA Y ARQUEO
// ==========================================
export const cashService = {
  getCurrentSession: (): Promise<CashSession | null> => apiClient.get<CashSession | null>('/cash/current'),

  openSession: (input: { initialAmount: number; notes: string; userName: string }): Promise<CashSession> =>
    apiClient.post<CashSession>('/cash/open', input),

  closeSession: (input: { countedCash: number; notes: string; closedBy: string }): Promise<CashSession> =>
    apiClient.post<CashSession>('/cash/close', input),

  addMovement: (movement: Omit<CashMovement, 'id' | 'createdAt'>): Promise<CashMovement> =>
    apiClient.post<CashMovement>('/cash/movements', movement),

  getSessionHistory: (): Promise<CashSession[]> => apiClient.get<CashSession[]>('/cash/history'),
};

// ==========================================
// 10. CONFIGURACIÓN DEL SISTEMA
// ==========================================
export const settingsService = {
  getSettings: (): Promise<Settings> => apiClient.get<Settings>('/settings'),

  updateSettings: (patch: Partial<Settings>): Promise<Settings> => apiClient.put<Settings>('/settings', patch),

  updateExchangeRate: (rate: number): Promise<{ exchangeRate: number }> =>
    apiClient.post<{ exchangeRate: number }>('/settings/exchange-rate', { exchangeRate: rate }),
};

// ==========================================
// 11. BITÁCORA Y AUDITORÍA
// ==========================================
export const auditService = {
  getLogs: (params?: { limit?: number; action?: string; userId?: string }): Promise<AuditLog[]> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.action) query.append('action', params.action);
    if (params?.userId) query.append('userId', params.userId);
    const qs = query.toString();
    return apiClient.get<AuditLog[]>(`/audit${qs ? `?${qs}` : ''}`);
  },

  logAction: (log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> => apiClient.post<AuditLog>('/audit', log),
};
