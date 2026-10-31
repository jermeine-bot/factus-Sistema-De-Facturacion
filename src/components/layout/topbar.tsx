import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CircleDot,
  Command,
  Menu,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useAuditStore } from '@/store/useAuditStore';
import { sessionExpected, useCashStore } from '@/store/useCashStore';
import { Money } from '@/components/shared/money';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatMoney, stockStatus, timeAgo } from '@/utils/format';
import { cn } from '@/lib/utils';

const titles: Record<string, string> = {
  '/': 'Resumen',
  '/pos': 'Punto de venta',
  '/caja': 'Caja y arqueo',
  '/caja/cierre': 'Cierre de caja',
  '/caja/cierres': 'Reporte de cierres',
  '/ventas': 'Ventas',
  '/ventas/articulos': 'Artículos vendidos',
  '/proformas': 'Proformas',
  '/compras': 'Compras',
  '/compras/anulacion': 'Anulación de compras',
  '/compras/ordenes': 'Órdenes de compra',
  '/gastos': 'Gastos',
  '/cuentas-por-pagar': 'Cuentas por pagar',
  '/inventario': 'Inventario',
  '/inventario/importar': 'Importar inventario',
  '/inventario/grupos': 'Grupos de artículos',
  '/inventario/monedas': 'Ajuste de monedas',
  '/inventario/valorizado': 'Inventario valorizado',
  '/inventario/ajustes': 'Ajustes de inventario',
  '/inventario/presentaciones': 'Presentaciones y combos',
  '/clientes': 'Clientes',
  '/proveedores': 'Proveedores',
  '/kardex': 'Kardex',
  '/pareto': 'Pareto de artículos',
  '/pareto/clientes': 'Pareto de clientes',
  '/reportes': 'Reportes',
  '/reportes/ventas': 'Reporte de ventas',
  '/reportes-inventario': 'Reporte de inventario',
  '/reportes-financieros': 'Reportes financieros',
  '/creditos': 'Créditos',
  '/estado-cuenta': 'Estado de cuenta',
  '/admin': 'Administración',
  '/configuracion': 'Configuración',
};

export function Topbar(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const products = useCatalogStore((state) => state.products);
  const customers = useCatalogStore((state) => state.customers);
  const logs = useAuditStore((state) => state.logs);
  const session = useCashStore((state) => state.current);
  const setMobileNav = useUIStore((state) => state.setMobileNav);
  const displayCurrency = useUIStore((state) => state.displayCurrency);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setQuery('');
    setSearchOpen(false);
  }, [location.pathname]);

  const lowStock = useMemo(
    () =>
      products.filter(
        (product) =>
          product.isActive &&
          product.type !== 'floating' &&
          product.type !== 'integrated' &&
          stockStatus(product.stock, product.minStock) !== 'ok',
      ),
    [products],
  );

  const criticalLogs = useMemo(
    () => logs.filter((log) => log.severity !== 'info').slice(0, 3),
    [logs],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return null;
    return {
      products: products
        .filter(
          (product) =>
            product.name.toLowerCase().includes(term) ||
            product.sku.toLowerCase().includes(term) ||
            product.category.toLowerCase().includes(term),
        )
        .slice(0, 4),
      customers: customers
        .filter(
          (customer) =>
            customer.name.toLowerCase().includes(term) ||
            customer.businessName.toLowerCase().includes(term) ||
            customer.phone.includes(term),
        )
        .slice(0, 3),
    };
  }, [query, products, customers]);

  const pageTitle = titles[location.pathname] ?? 'Factus';
  const notificationCount = lowStock.length + criticalLogs.length;
  const expected = session ? sessionExpected(session) : 0;

  const handleNavigate = (path: string): void => {
    setSearchOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={() => setMobileNav(true)}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 sm:block">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
          <span className="font-semibold tracking-tight text-foreground">Factus</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/80">{pageTitle}</span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground/50">
          {new Intl.DateTimeFormat('es-NI', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date())}
        </p>
      </div>

      <div className="relative ml-auto w-full max-w-[230px] lg:max-w-[320px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setSearchOpen(false), 160);
          }}
          placeholder="Buscar producto, cliente, factura…"
          aria-label="Búsqueda global"
          className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-9 pr-12 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors hover:bg-muted focus:border-blue-500 focus:bg-card focus:outline-none focus:ring-2 focus:ring-blue-500/25"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:flex">
          <Command className="h-2.5 w-2.5" /> K
        </span>

        {searchOpen && results ? (
          <div
            className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-fade-in"
            onMouseDown={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current);
            }}
          >
            {results.products.length === 0 && results.customers.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">Sin resultados para “{query}”.</p>
            ) : null}
            {results.products.length > 0 ? (
              <div className="p-1.5">
                <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Productos
                </p>
                {results.products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleNavigate('/inventario')}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="min-w-0 flex-1 truncate text-xs">{product.name}</span>
                    <span className="num text-[10px] text-muted-foreground">
                      {formatMoney(product.price, displayCurrency, settings.exchangeRate)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {results.customers.length > 0 ? (
              <div className="border-t border-border p-1.5">
                <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Clientes
                </p>
                {results.customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleNavigate('/clientes')}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <Users className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    <span className="min-w-0 flex-1 truncate text-xs">{customer.name}</span>
                    {customer.businessName ? (
                      <span className="max-w-[100px] truncate text-[10px] text-muted-foreground">
                        {customer.businessName}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => handleNavigate('/ventas')}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ReceiptText className="h-3 w-3" />
              Buscar en historial de ventas
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => navigate('/caja')}
        className={cn(
          'hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-medium transition-colors xl:flex',
          session
            ? 'border-success/15 bg-success/[0.06] text-success hover:bg-success/10'
            : 'border-warning/15 bg-warning/[0.06] text-warning hover:bg-warning/10',
        )}
        title="Estado de caja"
      >
        <CircleDot className="h-3 w-3" />
        {session ? 'Caja abierta' : 'Caja cerrada'}
        <span className="text-muted-foreground/40">·</span>
        <Money amount={expected} className="text-[10px]" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Notificaciones"
          >
            <Bell className="h-[18px] w-[18px]" />
            {notificationCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white ring-2 ring-background">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] p-0">
          <div className="border-b border-border px-3.5 py-3">
            <p className="font-display text-sm font-semibold">Centro de alertas</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {lowStock.length} alertas de stock · {criticalLogs.length} eventos críticos
            </p>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1.5">
            {lowStock.slice(0, 4).map((product) => (
              <DropdownMenuItem
                key={product.id}
                onClick={() => navigate('/inventario')}
                className="items-start gap-2.5 py-2.5"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{product.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Stock bajo: {product.stock} {product.unit} (mín. {product.minStock})
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
            {criticalLogs.map((log) => (
              <DropdownMenuItem
                key={log.id}
                onClick={() => navigate('/admin?tab=auditoria')}
                className="items-start gap-2.5 py-2.5"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/90">{log.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {log.userName} · {timeAgo(log.createdAt)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
            {notificationCount === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                Todo en orden. Sin alertas pendientes.
              </p>
            ) : null}
          </div>
          <div className="border-t border-border p-1.5">
            <DropdownMenuItem onClick={() => navigate('/reportes')} className="justify-center text-[11px] text-primary">
              Ver reporte operativo completo
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden pl-1 text-right 2xl:block">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Último cierre</p>
        <p className="text-[10px] text-muted-foreground">{formatDate(new Date().toISOString())}</p>
      </div>
    </header>
  );
}
