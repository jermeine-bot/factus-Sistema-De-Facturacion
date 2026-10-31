import { create } from 'zustand';
import type { Currency } from '@/types';

export type ThemePreference = 'light' | 'dark' | 'system';
export type TableDensity = 'compact' | 'comfortable';

interface UIState {
  theme: 'light' | 'dark';
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  displayCurrency: Currency;
  setDisplayCurrency: (currency: Currency) => void;
  tableDensity: TableDensity;
  setTableDensity: (density: TableDensity) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
}

const UI_SETTINGS_KEY = 'factus-ui-settings';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredUI(): {
  preference: ThemePreference;
  density: TableDensity;
  currency: Currency;
} {
  const defaults = {
    preference: 'light' as ThemePreference,
    density: 'comfortable' as TableDensity,
    currency: 'NIO' as Currency,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(UI_SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return defaults;
}

function persistUI(data: { preference: ThemePreference; density: TableDensity; currency: Currency }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

const initialUI = readStoredUI();
const resolvedInitialTheme =
  initialUI.preference === 'system' ? getSystemTheme() : initialUI.preference;

export const useUIStore = create<UIState>((set, get) => ({
  theme: resolvedInitialTheme,
  themePreference: initialUI.preference,
  setThemePreference: (preference) => {
    const theme = preference === 'system' ? getSystemTheme() : preference;
    set({ themePreference: preference, theme });
    persistUI({
      preference,
      density: get().tableDensity,
      currency: get().displayCurrency,
    });
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = theme;
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  },
  setTheme: (theme) => {
    set({ theme, themePreference: theme });
    persistUI({
      preference: theme,
      density: get().tableDensity,
      currency: get().displayCurrency,
    });
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = theme;
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  },
  displayCurrency: initialUI.currency,
  setDisplayCurrency: (displayCurrency) => {
    set({ displayCurrency });
    persistUI({
      preference: get().themePreference,
      density: get().tableDensity,
      currency: displayCurrency,
    });
  },
  tableDensity: initialUI.density,
  setTableDensity: (tableDensity) => {
    set({ tableDensity });
    persistUI({
      preference: get().themePreference,
      density: tableDensity,
      currency: get().displayCurrency,
    });
  },
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  mobileNavOpen: false,
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
}));
