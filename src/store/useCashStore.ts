import { create } from 'zustand';
import type { ArqueoLine, CashMovement, CashSession, MovementType } from '@/types';
import { round2, uid } from '@/utils/format';

interface CashState {
  current: CashSession | null;
  history: CashSession[];
  setCurrentSession: (session: CashSession | null) => void;
  setHistory: (history: CashSession[]) => void;
  openSession: (input: { initialAmount: number; notes: string; userName: string }) => CashSession;
  closeSession: (input: {
    arqueo: ArqueoLine[];
    counted: number;
    notes: string;
    userName: string;
  }) => CashSession;
  addMovement: (input: {
    type: MovementType;
    amount: number;
    concept: string;
    reference: string;
    userName: string;
  }) => void;
}

export function sessionExpected(session: CashSession): number {
  return round2(session.initialAmount + session.movements.reduce((acc, movement) => acc + movement.amount, 0));
}

export const useCashStore = create<CashState>((set, get) => ({
  current: null,
  history: [],

  setCurrentSession: (session) => set({ current: session }),
  setHistory: (history) => set({ history }),

  openSession: ({ initialAmount, notes, userName }) => {
    if (get().current?.status === 'open') {
      throw new Error('Ya existe una sesión de caja abierta.');
    }
    const session: CashSession = {
      id: uid('cash'),
      openedAt: new Date().toISOString(),
      openedBy: userName,
      initialAmount: round2(initialAmount),
      status: 'open',
      closedAt: null,
      closedBy: null,
      expectedCash: null,
      countedCash: null,
      difference: null,
      arqueo: [],
      notes,
      movements: [],
    };
    set({ current: session });
    return session;
  },

  closeSession: ({ arqueo, counted, notes, userName }) => {
    const current = get().current;
    if (!current || current.status !== 'open') {
      throw new Error('No hay una sesión de caja abierta.');
    }
    const expected = sessionExpected(current);
    const closed: CashSession = {
      ...current,
      status: 'closed',
      closedAt: new Date().toISOString(),
      closedBy: userName,
      expectedCash: expected,
      countedCash: round2(counted),
      difference: round2(counted - expected),
      arqueo,
      notes,
    };
    set((state) => ({
      current: null,
      history: [closed, ...state.history],
    }));
    return closed;
  },

  addMovement: ({ type, amount, concept, reference, userName }) => {
    const current = get().current;
    if (!current || current.status !== 'open') {
      throw new Error('No hay una caja abierta para registrar el movimiento.');
    }
    if (!Number.isFinite(amount) || amount === 0) return;
    const movement: CashMovement = {
      id: uid('cm'),
      type,
      amount: round2(amount),
      concept,
      reference,
      userName,
      createdAt: new Date().toISOString(),
    };
    set({
      current: { ...current, movements: [...current.movements, movement] },
    });
  },
}));
