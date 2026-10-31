/* ------------------------------------------------------------------ *
 * Factus — Domain types
 * Strict contracts shared across modules. No backend, no `any`.
 * ------------------------------------------------------------------ */

export type Currency = 'NIO' | 'USD';

export type ProductType = 'common' | 'floating' | 'integrated' | 'grouped';

export type UserRole = 'admin' | 'supervisor' | 'cashier' | 'warehouse';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';

export type SupplierType = 'purchase' | 'expense';

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled';

export type SaleStatus = 'completed' | 'void';

export type ProformaStatus = 'open' | 'converted' | 'expired';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type MovementType =
  | 'sale'
  | 'expense'
  | 'purchase'
  | 'withdrawal'
  | 'deposit'
  | 'credit_payment'
  | 'opening';

export type Denomination = 1 | 5 | 10 | 20 | 50 | 100 | 200 | 500;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string;
  avatarColor: string;
  isActive: boolean;
  lastLogin: string;
}

export interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
  /** How many base units this presentation contains. Base unit must equal 1. */
  ratio: number;
  /** Sale price for this presentation, in NIO. */
  price: number;
  barcode?: string;
}

export interface ComboComponent {
  productId: string;
  quantity: number;
  unitId?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  type: ProductType;
  /** Base-unit cost, NIO. */
  cost: number;
  /** Base-unit sale price, NIO. */
  price: number;
  /** Physical stock expressed in base units. */
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number;
  barcode?: string;
  isActive: boolean;
  units: UnitOption[];
  components: ComboComponent[];
  accent: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDraft {
  name: string;
  sku: string;
  description: string;
  category: string;
  type: ProductType;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number;
  barcode?: string;
  isActive: boolean;
  units: UnitOption[];
  components: ComboComponent[];
}

export interface Customer {
  id: string;
  name: string;
  businessName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  balance: number;
  notes: string;
  isActive: boolean;
  /** Optional for backwards compatibility with legacy records. */
  creditAuthorized?: boolean;
  /** Grace period used by the customer CRM. */
  creditDays?: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  type: ProductType;
  unitId: string;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  /** Percentage discount, 0–100. */
  discount: number;
  taxRate: number;
  /** Only for 'floating' items. */
  description?: string;
  components: ComboComponent[];
  accent: string;
}

export interface PaymentSplit {
  method: PaymentMethod;
  /** Always stored in NIO. */
  amount: number;
  currency: Currency;
  reference?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  type: ProductType;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  /** Base units contained in one sold unit (1 for common/floating/integrated). */
  unitRatio: number;
  discount: number;
  taxRate: number;
  total: number;
  description?: string;
  components: ComboComponent[];
}

export interface SaleTotals {
  gross: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  margin: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  items: SaleItem[];
  totals: SaleTotals;
  payments: PaymentSplit[];
  change: number;
  currency: Currency;
  exchangeRate: number;
  customerId: string | null;
  customerName: string;
  userId: string;
  userName: string;
  status: SaleStatus;
  isCashDrawer: boolean;
  notes: string;
  proformaId: string | null;
  createdAt: string;
}

export interface CreditNote {
  id: string;
  number: string;
  saleId: string;
  invoiceNumber: string;
  total: number;
  reason: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Proforma {
  id: string;
  number: string;
  items: CartItem[];
  totals: SaleTotals;
  customerId: string | null;
  customerName: string;
  userId: string;
  userName: string;
  status: ProformaStatus;
  validUntil: string;
  notes: string;
  createdAt: string;
  convertedSaleId: string | null;
}

export interface PurchaseLine {
  productId: string;
  name: string;
  unitId: string;
  unitLabel: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface Purchase {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseLine[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'credit' | 'transfer';
  isCashDrawerExpense: boolean;
  invoiceRef: string;
  notes: string;
  userId: string;
  userName: string;
  createdAt: string;
  voided?: boolean;
  voidedAt?: string | null;
  voidReason?: string;
}
 
export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseLine[];
  subtotal: number;
  tax: number;
  total: number;
  expectedDate: string;
  status: PurchaseOrderStatus;
  invoiceRef: string;
  notes: string;
  userId: string;
  userName: string;
  createdAt: string;
  receivedAt: string | null;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  method: 'cash' | 'transfer';
  reference: string;
  notes: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  concept: string;
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'credit' | 'transfer';
  isCashDrawerExpense: boolean;
  invoiceRef: string;
  createdAt: string;
  userId: string;
  userName: string;
}

export interface CashMovement {
  id: string;
  type: MovementType;
  /** Positive = cash in, negative = cash out. NIO. */
  amount: number;
  concept: string;
  reference: string;
  userName: string;
  createdAt: string;
}

export interface ArqueoLine {
  denomination: Denomination;
  quantity: number;
}

export interface CashSession {
  id: string;
  openedAt: string;
  openedBy: string;
  initialAmount: number;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedBy: string | null;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  arqueo: ArqueoLine[];
  notes: string;
  movements: CashMovement[];
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  previousStock: number;
  newStock: number;
  difference: number;
  unit: string;
  reason: string;
  issuer: string;
  createdAt: string;
}

export type AuditAction =
  | 'sale_completed'
  | 'sale_voided'
  | 'credit_note_created'
  | 'proforma_created'
  | 'proforma_converted'
  | 'product_created'
  | 'product_updated'
  | 'stock_adjusted'
  | 'credit_sale'
  | 'credit_limit_blocked'
  | 'credit_payment'
  | 'purchase_created'
  | 'purchase_order_created'
  | 'purchase_order_received'
  | 'supplier_payment'
  | 'supplier_created'
  | 'supplier_updated'
  | 'customer_credit_updated'
  | 'user_created'
  | 'user_updated'
  | 'expense_created'
  | 'cash_opened'
  | 'cash_closed'
  | 'cash_movement'
  | 'login'
  | 'settings_updated';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  description: string;
  userId: string;
  userName: string;
  severity: AuditSeverity;
  createdAt: string;
  metadata: Record<string, string | number | boolean>;
}

export type PrinterConnectionType = 'browser' | 'usb' | 'network' | 'bluetooth';
export type PrinterPaperWidth = '58mm' | '80mm' | 'letter';

export interface PrinterSettings {
  enabled: boolean;
  name: string;
  connectionType: PrinterConnectionType;
  paperWidth: PrinterPaperWidth;
  ipAddress?: string;
  port?: number;
  autoPrintOnSale: boolean;
  openCashDrawer: boolean;
  cutPaper: boolean;
  showLogo: boolean;
  printCustomer: boolean;
  copies: number;
  ticketHeader?: string;
  ticketFooter?: string;
}

export interface Settings {
  companyName: string;
  legalName: string;
  rnc: string;
  address: string;
  phone: string;
  email: string;
  currency: Currency;
  exchangeRate: number;
  taxRate: number;
  cashDrawerRequired: boolean;
  lowStockAlert: boolean;
  invoicePrefix: string;
  proformaPrefix: string;
  purchasePrefix: string;
  expensePrefix: string;
  footerMessage: string;
  companyLogo?: string | null;
  printer?: PrinterSettings;
}

export interface CatalogCategory {
  id: string;
  name: string;
  color: string;
}

export interface KpiPoint {
  label: string;
  value: number;
  compare?: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}
