import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  TrendingDown,
  Truck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  action?: 'logout';
}

export interface NavSubgroup {
  label: string;
  items: NavItem[];
}

export interface NavGroup {
  label: string;
  items?: NavItem[];
  subgroups?: NavSubgroup[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [{ label: 'Resumen general', href: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Ventas',
    items: [
      { label: 'Facturación (POS)', href: '/pos', icon: ShoppingCart },
      { label: 'Historial de ventas', href: '/ventas', icon: ReceiptText },
      { label: 'Estado de cuenta y reimpresiones', href: '/estado-cuenta', icon: ClipboardList },
      { label: 'Artículos vendidos', href: '/ventas/articulos', icon: Package },
      { label: 'Créditos', href: '/creditos', icon: Wallet },
      { label: 'Proformas', href: '/proformas', icon: FileText },
      { label: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
    ],
    subgroups: [
      {
        label: 'Caja',
        items: [
          { label: 'Apertura y arqueo', href: '/caja', icon: Wallet },
          { label: 'Cierre de caja', href: '/caja/cierre', icon: Calculator },
          { label: 'Reporte de cierres', href: '/caja/cierres', icon: BarChart3 },
        ],
      },
      {
        label: 'Reportes',
        items: [{ label: 'Reporte de ventas', href: '/reportes/ventas', icon: BarChart3 }],
      },
    ],
  },
  {
    label: 'Compras',
    items: [
      { label: 'Facturas de compra', href: '/compras', icon: ShoppingCart },
      { label: 'Anulación de facturas', href: '/compras/anulacion', icon: XCircle },
      { label: 'Órdenes de compra', href: '/compras/ordenes', icon: ClipboardList },
      { label: 'Registro de gastos', href: '/gastos', icon: TrendingDown },
      { label: 'Cuentas por pagar', href: '/cuentas-por-pagar', icon: Wallet },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { label: 'Registro de artículos', href: '/inventario', icon: Package },
      { label: 'Importar desde Excel', href: '/inventario/importar', icon: FileSpreadsheet },
      { label: 'Grupos de artículos', href: '/inventario/grupos', icon: FolderTree },
      { label: 'Ajustes de inventario', href: '/inventario/ajustes', icon: Sliders },
      { label: 'Inventario valorizado', href: '/inventario/valorizado', icon: Calculator },
      { label: 'Presentaciones y combos', href: '/inventario/presentaciones', icon: Boxes },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Registro de clientes', href: '/clientes', icon: Users },
      { label: 'Registro de proveedores', href: '/proveedores', icon: Truck },
      { label: 'Colaboradores y roles', href: '/admin?tab=usuarios', icon: ShieldCheck },
      { label: 'Kardex', href: '/kardex', icon: Activity },
      { label: 'Pareto de clientes', href: '/pareto/clientes', icon: BarChart3 },
      { label: 'Pareto de artículos', href: '/pareto', icon: BarChart3 },
      { label: 'Auditoría', href: '/admin?tab=auditoria', icon: ShieldCheck },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { label: 'Datos del negocio', href: '/configuracion', icon: Building2 },
    ],
  },
];