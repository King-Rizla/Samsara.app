import { create } from 'zustand';
import type { QueueItem, QueueStatus, ProcessingStage } from '../types/cv';

interface QueueStore {
  items: QueueItem[];
  selectedIds: Set<string>;
  lastSelectedId: string | null;  // For shift-click range selection

  // Actions
  addItem: (item: Omit<QueueItem, 'id' | 'createdAt'> & { id?: string }) => void;
  updateStatus: (id: string, status: QueueStatus, data?: Partial<QueueItem>) => void;
  updateStage: (id: string, stage: ProcessingStage) => void;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;

  // Selection
  toggleSelect: (id: string) => void;
  selectRange: (toId: string) => void;
  selectAll: (status?: QueueStatus) => void;
  clearSelection: () => void;

  // Bulk operations
  retryFailed: (ids: string[]) => Promise<void>;
  deleteSelected: () => Promise<void>;

  // Load from database
  loadFromDatabase: () => Promise<void>;
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  items: [],
  selectedIds: new Set(),
  lastSelectedId: null,

  addItem: (itemData) => {
    const item: QueueItem = {
      id: itemData.id || crypto.randomUUID(),
      fileName: itemData.fileName,
      fileType: itemData.fileType,
      filePath: itemData.filePath,
      status: itemData.status,
      stage: itemData.stage,
      error: itemData.error,
      data: itemData.data,
      parseConfidence: itemData.parseConfidence,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      items: [item, ...state.items],  // New items at top
    }));
  },

  updateStatus: (id, status, data) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, status, stage: undefined, ...data } : item
    ),
  })),

  updateStage: (id, stage) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, stage } : item
    ),
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
    selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
  })),

  removeItems: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      items: state.items.filter((item) => !idSet.has(item.id)),
      selectedIds: new Set([...state.selectedIds].filter((sid) => !idSet.has(sid))),
    }));
  },

  toggleSelect: (id) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    return { selectedIds: newSelected, lastSelectedId: id };
  }),

  selectRange: (toId) => set((state) => {
    if (!state.lastSelectedId) {
      return { selectedIds: new Set([toId]), lastSelectedId: toId };
    }

    const items = state.items;
    const fromIndex = items.findIndex((i) => i.id === state.lastSelectedId);
    const toIndex = items.findIndex((i) => i.id === toId);

    if (fromIndex === -1 || toIndex === -1) {
      return { selectedIds: new Set([toId]), lastSelectedId: toId };
    }

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = items.slice(start, end + 1).map((i) => i.id);

    return {
      selectedIds: new Set([...state.selectedIds, ...rangeIds]),
      lastSelectedId: toId,
    };
  }),

  selectAll: (status) => set((state) => {
    const filteredItems = status
      ? state.items.filter((i) => i.status === status)
      : state.items;
    return {
      selectedIds: new Set(filteredItems.map((i) => i.id)),
    };
  }),

  clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),

  retryFailed: async (ids) => {
    const { items, updateStatus, updateStage } = get();
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (item && item.status === 'failed') {
        updateStatus(id, 'submitted', { error: undefined });
        updateStage(id, 'Parsing...');

        try {
          const result = await window.api.reprocessCV(item.filePath);
          if (result.success && result.data) {
            updateStatus(id, 'completed', {
              data: result.data,
              parseConfidence: result.data.parse_confidence,
            });
          } else {
            updateStatus(id, 'failed', { error: result.error || 'Retry failed' });
          }
        } catch (err) {
          updateStatus(id, 'failed', {
            error: err instanceof Error ? err.message : 'Retry failed',
          });
        }
      }
    }
  },

  deleteSelected: async () => {
    const { selectedIds, removeItems } = get();
    const ids = [...selectedIds];

    // Delete from database
    for (const id of ids) {
      await window.api.deleteCV(id);
    }

    // Remove from store
    removeItems(ids);
  },

  loadFromDatabase: async () => {
    try {
      const result = await window.api.getAllCVs();
      if (result.success && result.data) {
        const items: QueueItem[] = result.data.map((cv) => ({
          id: cv.id,
          fileName: cv.file_name,
          fileType: cv.file_name.split('.').pop()?.toLowerCase() || 'unknown',
          filePath: cv.file_path || '',
          status: 'completed' as QueueStatus,
          parseConfidence: cv.parse_confidence,
          createdAt: cv.created_at,
        }));
        set({ items });
      }
    } catch (err) {
      console.error('Failed to load CVs from database:', err);
    }
  },
}));

// Expose store for E2E testing (development/test only)
if (typeof window !== 'undefined') {
  (window as unknown as { __queueStore: typeof useQueueStore }).__queueStore = useQueueStore;
}
