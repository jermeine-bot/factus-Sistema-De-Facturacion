import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useUIStore } from '@/store/useUIStore';
import { cn } from '@/lib/utils';

export function AppLayout(): React.JSX.Element {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const displayCurrency = useUIStore((state) => state.displayCurrency);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-300',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]',
        )}
      >
        <Topbar />
        <main className="flex-1 px-4 py-7 sm:px-7 lg:px-9 lg:py-8">
          <div
            key={`${location.pathname}-${displayCurrency}`}
            className="mx-auto w-full max-w-[1480px] animate-fade-in"
          >
            <Outlet />
          </div>
        </main>
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-border px-6 py-4 text-[10px] text-muted-foreground sm:flex-row">
          <p>Factus · Gestión empresarial · Frontend listo para integración con API</p>
          <p className="num">v2.4.0 · Nicaragua</p>
        </footer>
      </div>
    </div>
  );
}
