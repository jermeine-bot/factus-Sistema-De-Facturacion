import { create } from 'zustand';
import type { ToastMessage } from '@/types';
import { uid } from '@/utils/format';

interface ToastState {
  toasts: ToastMessage[];
  push: (toast: Omit<ToastMessage, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = uid('toast');
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id }] }));
    window.setTimeout(() => {
      get().dismiss(id);
    }, 4600);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string): void =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string): void =>
    useToastStore.getState().push({ title, description, variant: 'error' }),
  info: (title: string, description?: string): void =>
    useToastStore.getState().push({ title, description, variant: 'info' }),
  warning: (title: string, description?: string): void =>
    useToastStore.getState().push({ title, description, variant: 'warning' }),
};
