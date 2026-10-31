import { create } from 'zustand';
import type {
  CartItem,
  CatalogCategory,
  Customer,
  Product,
  ProductDraft,
  SaleItem,
  Supplier,
} from '@/types';
import { round2, uid } from '@/utils/format';
import { getAvailability, getUnit } from '@/utils/product';

export interface CustomerDraft {
  name: string;
  businessName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  notes: string;
  isActive: boolean;
  creditAuthorized?: boolean;
  creditDays?: number;
}

export interface SupplierDraft {
  name: string;
  type: Supplier['type'];
  contactName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  isActive: boolean;
}

interface CatalogState {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  categories: CatalogCategory[];
  createProduct: (draft: ProductDraft) => Product;
  importProducts: (drafts: ProductDraft[]) => { created: number; skipped: number; errors: string[] };
  updateProduct: (id: string, draft: ProductDraft) => Product;
  toggleProductActive: (id: string) => void;
  adjustStockAbsolute: (id: string, newStock: number) => void;
  receivePurchaseStock: (
    lines: Array<{ productId: string; quantity: number; unitId: string; unitCost?: number }>,
  ) => void;
  validateCartStock: (items: CartItem[]) => string[];
  applySaleStock: (items: CartItem[]) => void;
  restoreSaleStock: (items: SaleItem[]) => void;
  createCustomer: (draft: CustomerDraft) => Customer;
  updateCustomer: (id: string, draft: CustomerDraft) => Customer;
  toggleCustomerActive: (id: string) => void;
  increaseCustomerBalance: (id: string, amount: number) => void;
  decreaseCustomerBalance: (id: string, amount: number) => void;
  createSupplier: (draft: SupplierDraft) => Supplier;
  updateSupplier: (id: string, draft: SupplierDraft) => Supplier;
  toggleSupplierActive: (id: string) => void;
  increaseSupplierBalance: (id: string, amount: number) => void;
  decreaseSupplierBalance: (id: string, amount: number) => void;
  createCategory: (name: string, color: string) => CatalogCategory;
  updateCategory: (id: string, name: string, color: string) => CatalogCategory;
  deleteCategory: (id: string) => void;
  setProducts: (products: Product[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  setCategories: (categories: CatalogCategory[]) => void;
}

function deductProduct(
  map: Map<string, Product>,
  productId: string,
  baseQuantity: number,
  direction: 1 | -1,
  depth = 0,
): void {
  if (depth > 5 || baseQuantity === 0) return;
  const product = map.get(productId);
  if (!product || product.type === 'floating') return;

  if (product.type === 'integrated') {
    for (const component of product.components) {
      deductProduct(map, component.productId, component.quantity * baseQuantity, direction, depth + 1);
    }
    return;
  }

  map.set(productId, {
    ...product,
    stock: round2(product.stock - direction * baseQuantity),
    updatedAt: new Date().toISOString(),
  });
}

function reduceProducts(
  products: Product[],
  mutate: (map: Map<string, Product>) => void,
): Product[] {
  const map = new Map(products.map((product) => [product.id, { ...product }]));
  mutate(map);
  return products.map((product) => map.get(product.id) ?? product);
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  customers: [],
  suppliers: [],
  categories: [],

  setProducts: (products) => set({ products }),
  setCustomers: (customers) => set({ customers }),
  setSuppliers: (suppliers) => set({ suppliers }),
  setCategories: (categories) => set({ categories }),

  createProduct: (draft) => {
    const now = new Date().toISOString();
    const product: Product = {
      ...draft,
      id: uid('prod'),
      units:
        draft.units.length > 0
          ? draft.units
          : [
              {
                id: 'u-base',
                name: draft.unit,
                abbreviation: draft.unit,
                ratio: 1,
                price: draft.price,
              },
            ],
      accent: '#3b82f6',
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ products: [product, ...state.products] }));
    return product;
  },

  importProducts: (drafts) => {
    const result = { created: 0, skipped: 0, errors: [] as string[] };
    const existingSkus = new Set(get().products.map((p) => p.sku.toLowerCase()));
    const newProducts: Product[] = [];
    for (const raw of drafts) {
      const name = (raw.name ?? '').trim();
      const sku = (raw.sku ?? '').trim();
      if (!name) {
        result.errors.push('Fila sin nombre de artículo omitida.');
        result.skipped += 1;
        continue;
      }
      const finalSku = sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      if (existingSkus.has(finalSku.toLowerCase())) {
        result.errors.push(`SKU duplicado: ${finalSku} (omitido).`);
        result.skipped += 1;
        continue;
      }
      // ensure category exists
      const category = (raw.category ?? '').trim() || 'General';
      if (!get().categories.some((c) => c.name === category)) {
        get().createCategory(category, '#3b82f6');
      }
      const now = new Date().toISOString();
      const product: Product = {
        ...raw,
        id: uid('prod'),
        name,
        sku: finalSku,
        category,
        description: raw.description ?? '',
        type: raw.type ?? 'common',
        cost: Number.isFinite(raw.cost) ? raw.cost : 0,
        price: Number.isFinite(raw.price) ? raw.price : 0,
        stock: Number.isFinite(raw.stock) ? raw.stock : 0,
        minStock: Number.isFinite(raw.minStock) ? raw.minStock : 0,
        unit: raw.unit || 'unidad',
        taxRate: Number.isFinite(raw.taxRate) ? raw.taxRate : 0,
        barcode: raw.barcode,
        isActive: raw.isActive !== false,
        units: raw.units && raw.units.length > 0 ? raw.units : [{ id: 'u-base', name: raw.unit || 'unidad', abbreviation: raw.unit || 'unidad', ratio: 1, price: raw.price }],
        components: raw.components ?? [],
        accent: '#3b82f6',
        createdAt: now,
        updatedAt: now,
      };
      newProducts.push(product);
      existingSkus.add(finalSku.toLowerCase());
      result.created += 1;
    }
    if (newProducts.length > 0) {
      set((state) => ({ products: [...newProducts, ...state.products] }));
    }
    return result;
  },
 
  updateProduct: (id, draft) => {
    const current = get().products.find((product) => product.id === id);
    if (!current) throw new Error('Producto no encontrado.');
    // Security lock: physical stock can never be edited from the product form.
    const updated: Product = {
      ...current,
      ...draft,
      stock: current.stock,
      units: draft.units.length > 0 ? draft.units : current.units,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      products: state.products.map((product) => (product.id === id ? updated : product)),
    }));
    return updated;
  },

  toggleProductActive: (id) => {
    set((state) => ({
      products: state.products.map((product) =>
        product.id === id
          ? { ...product, isActive: !product.isActive, updatedAt: new Date().toISOString() }
          : product,
      ),
    }));
  },

  adjustStockAbsolute: (id, newStock) => {
    set((state) => ({
      products: state.products.map((product) =>
        product.id === id
          ? { ...product, stock: round2(Math.max(0, newStock)), updatedAt: new Date().toISOString() }
          : product,
      ),
    }));
  },

  receivePurchaseStock: (lines) => {
    set((state) => ({
      products: reduceProducts(state.products, (map) => {
        for (const line of lines) {
          const product = map.get(line.productId);
          if (!product || product.type === 'floating') continue;
          if (product.type === 'integrated') continue;
          const unit = getUnit(product, line.unitId);
          const baseQuantity = line.quantity * (unit.ratio || 1);
          map.set(product.id, {
            ...product,
            stock: round2(product.stock + baseQuantity),
            cost:
              typeof line.unitCost === 'number' && line.unitCost > 0
                ? round2(line.unitCost / (unit.ratio || 1))
                : product.cost,
            updatedAt: new Date().toISOString(),
          });
        }
      }),
    }));
  },

  validateCartStock: (items) => {
    const products = get().products;
    const required = new Map<string, number>();

    for (const item of items) {
      if (item.type === 'floating') continue;
      if (item.type === 'integrated') {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
          required.set(item.productId, 1);
          continue;
        }
        const combos = getAvailability(product, products);
        if (combos < item.quantity) {
          required.set(item.productId, Number.POSITIVE_INFINITY);
        }
        continue;
      }
      const product = products.find((entry) => entry.id === item.productId);
      const ratio = product ? getUnit(product, item.unitId).ratio : 1;
      required.set(item.productId, (required.get(item.productId) ?? 0) + item.quantity * ratio);
    }

    const errors: string[] = [];
    for (const [productId, quantity] of required) {
      const product = products.find((entry) => entry.id === productId);
      if (!product) {
        errors.push('Uno de los productos ya no existe en el catálogo.');
        continue;
      }
      if (quantity === Number.POSITIVE_INFINITY || getAvailability(product, products) < quantity) {
        errors.push(`Stock insuficiente para ${product.name}.`);
      }
    }
    return errors;
  },

  applySaleStock: (items) => {
    set((state) => ({
      products: reduceProducts(state.products, (map) => {
        for (const item of items) {
          if (item.type === 'floating') continue;
          if (item.type === 'integrated') {
            for (const component of item.components) {
              deductProduct(map, component.productId, component.quantity * item.quantity, 1);
            }
            continue;
          }
          const product = map.get(item.productId);
          const ratio = product ? getUnit(product, item.unitId).ratio : 1;
          deductProduct(map, item.productId, item.quantity * ratio, 1);
        }
      }),
    }));
  },

  restoreSaleStock: (items) => {
    set((state) => ({
      products: reduceProducts(state.products, (map) => {
        for (const item of items) {
          if (item.type === 'floating') continue;
          if (item.type === 'integrated') {
            for (const component of item.components) {
              deductProduct(map, component.productId, component.quantity * item.quantity, -1);
            }
            continue;
          }
          deductProduct(map, item.productId, item.quantity * (item.unitRatio || 1), -1);
        }
      }),
    }));
  },

  createCustomer: (draft) => {
    const customer: Customer = {
      ...draft,
      id: uid('cust'),
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ customers: [customer, ...state.customers] }));
    return customer;
  },

  updateCustomer: (id, draft) => {
    const current = get().customers.find((customer) => customer.id === id);
    if (!current) throw new Error('Cliente no encontrado.');
    const updated: Customer = { ...current, ...draft, balance: current.balance };
    set((state) => ({
      customers: state.customers.map((customer) => (customer.id === id ? updated : customer)),
    }));
    return updated;
  },

  toggleCustomerActive: (id) => {
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id === id ? { ...customer, isActive: !customer.isActive } : customer,
      ),
    }));
  },

  increaseCustomerBalance: (id, amount) => {
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id === id
          ? { ...customer, balance: round2(customer.balance + amount) }
          : customer,
      ),
    }));
  },

  decreaseCustomerBalance: (id, amount) => {
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id === id
          ? { ...customer, balance: round2(Math.max(0, customer.balance - amount)) }
          : customer,
      ),
    }));
  },

  increaseSupplierBalance: (id, amount) => {
    set((state) => ({
      suppliers: state.suppliers.map((supplier) =>
        supplier.id === id
          ? { ...supplier, balance: round2(supplier.balance + amount) }
          : supplier,
      ),
    }));
  },

  decreaseSupplierBalance: (id, amount) => {
    set((state) => ({
      suppliers: state.suppliers.map((supplier) =>
        supplier.id === id
          ? { ...supplier, balance: round2(Math.max(0, supplier.balance - amount)) }
          : supplier,
      ),
    }));
  },

  createSupplier: (draft) => {
    const supplier: Supplier = {
      ...draft,
      id: uid('supplier'),
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ suppliers: [supplier, ...state.suppliers] }));
    return supplier;
  },

  updateSupplier: (id, draft) => {
    const current = get().suppliers.find((supplier) => supplier.id === id);
    if (!current) throw new Error('Proveedor no encontrado.');
    const updated: Supplier = { ...current, ...draft, balance: current.balance };
    set((state) => ({
      suppliers: state.suppliers.map((supplier) => (supplier.id === id ? updated : supplier)),
    }));
    return updated;
  },

  toggleSupplierActive: (id) => {
    set((state) => ({
      suppliers: state.suppliers.map((supplier) =>
        supplier.id === id ? { ...supplier, isActive: !supplier.isActive } : supplier,
      ),
    }));
  },

  createCategory: (name, color) => {
    const category: CatalogCategory = { id: uid('cat'), name: name.trim(), color };
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },
  updateCategory: (id, name, color) => {
    const current = get().categories.find((c) => c.id === id);
    if (!current) throw new Error('Grupo no encontrado.');
    const updated: CatalogCategory = { ...current, name: name.trim(), color };
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
    }));
    return updated;
  },
  deleteCategory: (id) => {
    const category = get().categories.find((c) => c.id === id);
    if (!category) return;
    const inUse = get().products.some((p) => p.category === category.name);
    if (inUse) throw new Error('No se puede eliminar un grupo con artículos asociados.');
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },
}));
