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

interface ActivityItem {
  type: 'success' | 'update' | 'create' | 'error';
  text: string;
  time: string;
}

interface GenerationMeta {
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface AppState {
  yaml: string;
  setYaml: (yaml: string) => void;

  lastPrompt: string;
  setLastPrompt: (p: string) => void;

  promptHistory: string[];
  addPromptHistory: (p: string) => void;

  validationErrors: { resource: string; field?: string; message: string }[];
  validationPassed: boolean | null;
  setValidationErrors: (errs: AppState['validationErrors'], passed?: boolean) => void;

  generationMeta: GenerationMeta | null;
  setGenerationMeta: (meta: GenerationMeta | null) => void;

  history: HistoryItem[];
  addHistory: (item: HistoryItem) => void;
  removeHistory: (id: string) => void;

  resourceStatuses: ResourceStatus[];
  upsertStatus: (s: ResourceStatus) => void;
  clearStatuses: () => void;

  activities: ActivityItem[];
  addActivity: (a: ActivityItem) => void;

  selectedProvider: string;
  setSelectedProvider: (p: string) => void;

  detectedSchemas: string[];
  setDetectedSchemas: (schemas: string[]) => void;
}

export const useStore = create<AppState>((set) => ({
  yaml: '',
  setYaml: (yaml) => set({ yaml }),

  lastPrompt: '',
  setLastPrompt: (p) => set({ lastPrompt: p }),

  promptHistory: [],
  addPromptHistory: (p) => set((state) => ({
    promptHistory: [p, ...state.promptHistory.filter((h) => h !== p)].slice(0, 10),
  })),

  validationErrors: [],
  validationPassed: null,
  setValidationErrors: (errs, passed) => set({ validationErrors: errs, validationPassed: passed ?? null }),

  generationMeta: null,
  setGenerationMeta: (meta) => set({ generationMeta: meta }),

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

  activities: [],
  addActivity: (a) => set((state) => ({ activities: [a, ...state.activities].slice(0, 20) })),

  selectedProvider: 'ollama',
  setSelectedProvider: (p) => set({ selectedProvider: p }),

  detectedSchemas: [],
  setDetectedSchemas: (schemas) => set({ detectedSchemas: schemas }),
}));
