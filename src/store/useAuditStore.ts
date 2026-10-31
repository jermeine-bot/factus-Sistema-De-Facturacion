import { create } from 'zustand';
import type { AuditAction, AuditLog, AuditSeverity } from '@/types';
import { uid } from '@/utils/format';

interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId: string;
  description: string;
  severity?: AuditSeverity;
  userId?: string;
  userName?: string;
  metadata?: Record<string, string | number | boolean>;
}

interface AuditState {
  logs: AuditLog[];
  setLogs: (logs: AuditLog[]) => void;
  addLog: (input: AuditInput) => AuditLog;
}

export const useAuditStore = create<AuditState>((set) => ({
  logs: [],
  setLogs: (logs) => set({ logs }),
  addLog: (input) => {
    const log: AuditLog = {
      id: uid('audit'),
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      description: input.description,
      severity: input.severity ?? 'info',
      userId: input.userId ?? 'usr-1',
      userName: input.userName ?? 'Sistema',
      createdAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    set((state) => ({ logs: [log, ...state.logs] }));
    return log;
  },
}));
