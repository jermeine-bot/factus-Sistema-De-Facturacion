import { create } from 'zustand';
import type { Settings, User, UserRole } from '@/types';
import { defaultSettings, defaultUsers } from '@/store/defaults';
import { useAuditStore } from '@/store/useAuditStore';
import { uid } from '@/utils/format';

export interface UserDraft {
  name: string;
  email: string;
  role: UserRole;
  pin: string;
  isActive: boolean;
}


const SETTINGS_KEY = 'factus-settings';

function readSettings(): Settings {
  const base: Settings = { ...defaultSettings };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...base, ...parsed };
    }
  } catch {
    // ignore
  }
  return base;
}

function writeSettings(settings: Settings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

interface SettingsState {
  users: User[];
  currentUser: User;
  isAuthenticated: boolean;
  settings: Settings;
  login: (userId: string) => void;
  logout: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateExchangeRate: (rate: number) => void;
  createUser: (draft: UserDraft) => User;
  updateUser: (id: string, draft: UserDraft) => User;
  toggleUserActive: (id: string) => void;
  setUsers: (users: User[]) => void;
  setCurrentUser: (user: User) => void;
  setSettings: (settings: Settings) => void;
}

const AVATAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6'];

function normalizeUserDraft(draft: UserDraft): UserDraft {
  const pin = draft.pin.trim();
  if (!draft.name.trim()) throw new Error('El nombre del colaborador es obligatorio.');
  if (!draft.email.trim() || !draft.email.includes('@')) throw new Error('Ingresa un correo válido.');
  if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 dígitos.');
  return { ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase(), pin };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  users: defaultUsers.map((user) => ({ ...user })),
  currentUser: { ...defaultUsers[0] },
  isAuthenticated: true,
  settings: readSettings(),

  setUsers: (users) => set({ users }),
  setCurrentUser: (currentUser) => set({ currentUser, isAuthenticated: true }),
  setSettings: (settings) => set({ settings }),

  login: (userId) => {
    const user = get().users.find((entry) => entry.id === userId);
    if (!user) throw new Error('Usuario no encontrado.');
    if (!user.isActive) throw new Error('Este usuario está desactivado.');
    const now = new Date().toISOString();
    set((state) => ({
      currentUser: { ...user, lastLogin: now },
      isAuthenticated: true,
      users: state.users.map((entry) => (entry.id === userId ? { ...entry, lastLogin: now } : entry)),
    }));
    useAuditStore.getState().addLog({
      action: 'login',
      entity: 'Sesión',
      entityId: user.id,
      description: `${user.name} inició sesión como ${user.role}.`,
      userId: user.id,
      userName: user.name,
      metadata: { rol: user.role },
    });
  },

  logout: () => set({ isAuthenticated: false }),

  updateSettings: (patch) => {
    const before = get().settings;
    const next = { ...before, ...patch };
    set({ settings: next });
    writeSettings(next);
    useAuditStore.getState().addLog({
      action: 'settings_updated',
      entity: 'Configuración',
      entityId: 'settings',
      description: 'Se actualizaron los parámetros generales del sistema.',
      userName: get().currentUser.name,
      userId: get().currentUser.id,
      metadata: {
        tasaAnterior: before.exchangeRate,
        tasaNueva: next.exchangeRate,
        iva: next.taxRate,
      },
    });
  },

  updateExchangeRate: (rate) => {
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('La tasa de cambio debe ser mayor que cero.');
    const before = get().settings.exchangeRate;
    set((state) => {
      const next = { ...state.settings, exchangeRate: rate };
      writeSettings(next);
      return { settings: next };
    });
    useAuditStore.getState().addLog({
      action: 'settings_updated',
      entity: 'Divisas',
      entityId: 'exchange-rate',
      description: `Tasa de cambio actualizada de C$ ${before.toFixed(2)} a C$ ${rate.toFixed(2)} por USD.`,
      userName: get().currentUser.name,
      userId: get().currentUser.id,
      metadata: { anterior: before, nueva: rate },
    });
  },

  createUser: (draft) => {
    const normalized = normalizeUserDraft(draft);
    const duplicate = get().users.some((user) => user.email.toLowerCase() === normalized.email);
    if (duplicate) throw new Error('Ya existe un colaborador con ese correo.');
    const user: User = {
      ...normalized,
      id: uid('usr'),
      pin: normalized.pin || '1234',
      avatarColor: AVATAR_COLORS[get().users.length % AVATAR_COLORS.length],
      lastLogin: new Date().toISOString(),
    };
    set((state) => ({ users: [user, ...state.users] }));
    const actor = get().currentUser;
    useAuditStore.getState().addLog({
      action: 'user_created',
      entity: 'Usuario',
      entityId: user.id,
      description: `${user.name} fue agregado como ${user.role}.`,
      userId: actor.id,
      userName: actor.name,
      metadata: { correo: user.email, rol: user.role },
    });
    return user;
  },

  updateUser: (id, draft) => {
    const normalized = normalizeUserDraft(draft);
    const current = get().users.find((user) => user.id === id);
    if (!current) throw new Error('Colaborador no encontrado.');
    const duplicate = get().users.some(
      (user) => user.id !== id && user.email.toLowerCase() === normalized.email,
    );
    if (duplicate) throw new Error('Ya existe un colaborador con ese correo.');
    const updated: User = { ...current, ...normalized, pin: normalized.pin || current.pin };
    set((state) => ({
      users: state.users.map((user) => (user.id === id ? updated : user)),
      currentUser: state.currentUser.id === id ? updated : state.currentUser,
    }));
    const actor = get().currentUser;
    useAuditStore.getState().addLog({
      action: 'user_updated',
      entity: 'Usuario',
      entityId: id,
      description: `${updated.name} actualizado (${updated.role}).`,
      userId: actor.id,
      userName: actor.name,
      metadata: { correo: updated.email, rol: updated.role, activo: updated.isActive },
    });
    return updated;
  },

  toggleUserActive: (id) => {
    const user = get().users.find((entry) => entry.id === id);
    if (!user) return;
    if (user.id === get().currentUser.id) throw new Error('No puedes desactivar tu propio usuario.');
    set((state) => ({
      users: state.users.map((entry) =>
        entry.id === id ? { ...entry, isActive: !entry.isActive } : entry,
      ),
    }));
    useAuditStore.getState().addLog({
      action: 'settings_updated',
      entity: 'Usuario',
      entityId: id,
      description: `Usuario ${user.name} ${user.isActive ? 'desactivado' : 'activado'}.`,
      severity: 'warning',
      userName: get().currentUser.name,
      userId: get().currentUser.id,
    });
  },
}));
