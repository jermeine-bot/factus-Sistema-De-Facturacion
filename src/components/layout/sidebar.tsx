import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, LogOut as LogOutIcon, X } from 'lucide-react';
import { navGroups } from '@/components/layout/nav-items';
import { useUIStore } from '@/store/useUIStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { cn } from '@/lib/utils';

export function Brand({
  collapsed = false,
  inverse = false,
}: {
  collapsed?: boolean;
  inverse?: boolean;
}): React.JSX.Element {
  const logo = useSettingsStore((state) => state.settings.companyLogo);
  return (
    <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
      {logo ? (
        <img src={logo} alt="Logotipo" className="h-9 w-9 shrink-0 rounded-xl object-contain ring-1 ring-inset ring-white/20" />
      ) : (
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-950/30 ring-1 ring-inset ring-white/20">
          <span className="font-display text-[19px] font-extrabold tracking-[-0.08em] text-white">f</span>
        </div>
      )}
      {!collapsed ? (
        <div className="min-w-0">
          <p
            className={cn(
              'font-display text-[15px] font-extrabold leading-none tracking-tight',
              inverse ? 'text-white' : 'text-slate-900 dark:text-white',
            )}
          >
            Factus
          </p>
          <p
            className={cn(
              'mt-1 text-[9px] font-semibold uppercase tracking-[0.24em]',
              inverse ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            GESTIÓN EMPRESARIAL
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar(): React.JSX.Element {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const mobileOpen = useUIStore((state) => state.mobileNavOpen);
  const setMobileNav = useUIStore((state) => state.setMobileNav);
  const user = useSettingsStore((state) => state.currentUser);
  const logout = useSettingsStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((group) => [group.label, true])),
  );

  const toggleGroup = (label: string): void => {
    setExpanded((state) => ({ ...state, [label]: !state[label] }));
  };

  const isItemActive = (href: string): boolean => {
    const [path, search] = href.split('?');
    if (location.pathname !== path) return false;
    const itemParams = new URLSearchParams(search ?? '');
    const currentParams = new URLSearchParams(location.search);
    for (const [key, value] of itemParams) {
      if (currentParams.get(key) !== value) return false;
    }
    if (!search && (currentParams.has('tab') || currentParams.has('page'))) {
      if (path === '/inventario' || path === '/admin' || path === '/configuracion') return false;
    }
    return true;
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-[width,transform] duration-300',
          collapsed ? 'w-[76px]' : 'w-[264px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-slate-800 px-4', collapsed && 'justify-center px-0')}>
          <div className="flex w-full items-center justify-between">
            <Brand collapsed={collapsed} inverse />
            <button
              type="button"
              onClick={() => setMobileNav(false)}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => {
            const isOpen = collapsed ? true : (expanded[group.label] ?? true);
            return (
            <div key={group.label}>
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="mb-1.5 flex w-full items-center justify-between px-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-300"
                  aria-expanded={isOpen}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn('h-3 w-3 transition-transform', isOpen ? 'rotate-0' : '-rotate-90')}
                  />
                </button>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-slate-800" />
              )}
              {isOpen ? (
                <div className="space-y-0.5 animate-fade-in">
                  {(group.items ?? []).map((item) => {
                    const active = item.action ? false : isItemActive(item.href);
                    const content = (
                      <>
                        <item.icon
                          className={cn(
                            'h-[17px] w-[17px] shrink-0 transition-colors',
                            active ? 'text-white' : 'text-slate-500 group-hover:text-slate-200',
                          )}
                        />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </>
                    );
                    const className = cn(
                      'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-200',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    );
                    if (item.action === 'logout') {
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            logout();
                            setMobileNav(false);
                            navigate('/login');
                          }}
                          title={collapsed ? item.label : undefined}
                          className={className}
                        >
                          {content}
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileNav(false)}
                        title={collapsed ? item.label : undefined}
                        className={className}
                      >
                        {content}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
              {isOpen && group.subgroups
                ? group.subgroups.map((sub) => {
                    const subKey = `${group.label}:${sub.label}`;
                    const subOpen = collapsed ? true : (expanded[subKey] ?? true);
                    return (
                      <div key={sub.label} className="mt-1">
                        {!collapsed ? (
                          <button
                            type="button"
                            onClick={() => toggleGroup(subKey)}
                            className="mb-1 flex w-full items-center justify-between px-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition-colors hover:text-slate-400"
                            aria-expanded={subOpen}
                          >
                            <span>{sub.label}</span>
                            <ChevronDown className={cn('h-3 w-3 transition-transform', subOpen ? 'rotate-0' : '-rotate-90')} />
                          </button>
                        ) : null}
                        {subOpen ? (
                          <div className="space-y-0.5">
                            {sub.items.map((item) => {
                              const active = isItemActive(item.href);
                              return (
                                <NavLink
                                  key={item.href}
                                  to={item.href}
                                  onClick={() => setMobileNav(false)}
                                  title={collapsed ? item.label : undefined}
                                  className={cn(
                                    'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-200',
                                    collapsed && 'justify-center px-0',
                                    active
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                                  )}
                                >
                                  <item.icon className={cn('h-[17px] w-[17px] shrink-0 transition-colors', active ? 'text-white' : 'text-slate-500 group-hover:text-slate-200')} />
                                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                                </NavLink>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>
          );
          })}
        </nav>

        <div className={cn('space-y-2.5 border-t border-slate-800 p-3', collapsed && 'px-2')}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-slate-700"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.name
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                <p className="text-[10px] capitalize text-slate-400">{user.role}</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/40 py-1.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            title="Cerrar sesión"
          >
            <LogOutIcon className="h-3.5 w-3.5" />
            {!collapsed ? 'Cerrar sesión' : null}
          </button>

        </div>
      </aside>
    </>
  );
}