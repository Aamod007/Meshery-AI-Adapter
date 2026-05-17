import { create } from 'zustand';

interface HistoryItem {
  id: string;
  resources: string[];
  appliedAt: string;
}

export interface ResourceStatus {
  kind: 'status' | 'error' | 'ping';
  resource: string;
  ready: boolean;
  message: string;
}

interface AppState {
  yaml: string;
  setYaml: (yaml: string) => void;

  lastPrompt: string;
  setLastPrompt: (p: string) => void;

  validationErrors: { resource: string; field?: string; message: string }[];
  setValidationErrors: (errs: AppState['validationErrors']) => void;

  history: HistoryItem[];
  addHistory: (item: HistoryItem) => void;
  removeHistory: (id: string) => void;

  resourceStatuses: ResourceStatus[];
  upsertStatus: (s: ResourceStatus) => void;
  clearStatuses: () => void;
}

export const useStore = create<AppState>((set) => ({
  yaml: '',
  setYaml: (yaml) => set({ yaml }),

  lastPrompt: '',
  setLastPrompt: (p) => set({ lastPrompt: p }),

  validationErrors: [],
  setValidationErrors: (errs) => set({ validationErrors: errs }),

  history: [],
  addHistory: (item) => set((state) => ({ history: [item, ...state.history] })),
  removeHistory: (id) => set((state) => ({ history: state.history.filter((h) => h.id !== id) })),

  resourceStatuses: [],
  upsertStatus: (s) =>
    set((state) => {
      const existing = state.resourceStatuses.findIndex((r) => r.resource === s.resource);
      if (existing >= 0) {
        const updated = [...state.resourceStatuses];
        updated[existing] = s;
        return { resourceStatuses: updated };
      }
      return { resourceStatuses: [...state.resourceStatuses, s] };
    }),
  clearStatuses: () => set({ resourceStatuses: [] }),
}));
