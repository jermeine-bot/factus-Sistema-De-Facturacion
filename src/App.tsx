import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { Brand } from '@/components/layout/sidebar';

const LoginPage = lazy(() => import('@/modules/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage'));
const POSPage = lazy(() => import('@/modules/pos/POSPage'));
const CashPage = lazy(() => import('@/modules/cash/CashPage'));
const SalesPage = lazy(() => import('@/modules/sales/SalesPage'));
const ReturnsPage = lazy(() => import('@/modules/returns/ReturnsPage'));
const ProformasPage = lazy(() => import('@/modules/sales/ProformasPage'));
const PurchasesModule = lazy(() => import('@/modules/Purchases/PurchasesModule'));
const ExpensesModule = lazy(() => import('@/modules/Purchases/ExpensesModule'));
const InventoryModule = lazy(() => import('@/modules/Inventory/InventoryModule'));
const CustomersPage = lazy(() => import('@/modules/customers/CustomersPage'));
const SuppliersPage = lazy(() => import('@/modules/suppliers/SuppliersPage'));
const ReportsPage = lazy(() => import('@/modules/reports/ReportsPage'));
const ParetoPage = lazy(() => import('@/modules/reports/ParetoPage'));
const InventoryReportPage = lazy(() => import('@/modules/reports/InventoryReportPage'));
const FinancialReportPage = lazy(() => import('@/modules/reports/FinancialReportPage'));
const AccountStatementPage = lazy(() => import('@/modules/customers/AccountStatementPage'));
const AdminModule = lazy(() => import('@/modules/Admin/AdminModule'));
const CashRegisterClose = lazy(() => import('@/modules/POS/CashRegisterClose'));
const ConfiguracionPage = lazy(() => import('@/modules/config/ConfiguracionPage'));
const SoldItemsPage = lazy(() => import('@/modules/sales/SoldItemsPage'));
const CashClosuresPage = lazy(() => import('@/modules/cash/CashClosuresPage'));
const AccountsPayablePage = lazy(() => import('@/modules/Purchases/AccountsPayablePage'));
const CancelPurchasePage = lazy(() => import('@/modules/Purchases/CancelPurchasePage'));
const InventoryValuedPage = lazy(() => import('@/modules/Inventory/InventoryValuedPage'));
const ImportInventoryPage = lazy(() => import('@/modules/Inventory/ImportInventoryPage'));
const ArticleGroupsPage = lazy(() => import('@/modules/Inventory/ArticleGroupsPage'));
const CurrencyAdjustPage = lazy(() => import('@/modules/Inventory/CurrencyAdjustPage'));
const AdjustmentsPage = lazy(() => import('@/modules/Inventory/AdjustmentsPage'));
const PresentationsPage = lazy(() => import('@/modules/Inventory/PresentationsPage'));
const KardexPage = lazy(() => import('@/modules/admin/KardexPage'));
const ParetoCustomersPage = lazy(() => import('@/modules/admin/ParetoCustomersPage'));
const NotFoundPage = lazy(() => import('@/modules/auth/NotFoundPage'));

function LoadingScreen(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <Brand />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Cargando módulo</p>
    </div>
  );
}

function ProtectedLayout(): React.JSX.Element {
  const isAuthenticated = useSettingsStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

export default function App(): React.JSX.Element {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
  }, [theme]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/caja" element={<CashPage />} />
            <Route path="/caja/cierre" element={<CashRegisterClose />} />
            <Route path="/caja/cierres" element={<CashClosuresPage />} />
            <Route path="/ventas" element={<SalesPage />} />
            <Route path="/ventas/articulos" element={<SoldItemsPage />} />
            <Route path="/devoluciones" element={<ReturnsPage />} />
            <Route path="/proformas" element={<ProformasPage />} />
            <Route path="/compras" element={<PurchasesModule />} />
            <Route path="/compras/anulacion" element={<CancelPurchasePage />} />
            <Route path="/compras/ordenes" element={<PurchasesModule />} />
            <Route path="/gastos" element={<ExpensesModule />} />
            <Route path="/cuentas-por-pagar" element={<AccountsPayablePage />} />
            <Route path="/inventario" element={<InventoryModule />} />
            <Route path="/inventario/importar" element={<ImportInventoryPage />} />
            <Route path="/inventario/grupos" element={<ArticleGroupsPage />} />
            <Route path="/inventario/monedas" element={<CurrencyAdjustPage />} />
            <Route path="/inventario/valorizado" element={<InventoryValuedPage />} />
            <Route path="/inventario/ajustes" element={<AdjustmentsPage />} />
            <Route path="/inventario/presentaciones" element={<PresentationsPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/kardex" element={<KardexPage />} />
            <Route path="/pareto" element={<ParetoPage />} />
            <Route path="/pareto/clientes" element={<ParetoCustomersPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/reportes/ventas" element={<ReportsPage />} />
            <Route path="/reportes-inventario" element={<InventoryReportPage />} />
            <Route path="/reportes-financieros" element={<FinancialReportPage />} />
            <Route path="/creditos" element={<CustomersPage />} />
            <Route path="/estado-cuenta" element={<AccountStatementPage />} />
            <Route path="/admin" element={<AdminModule />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
