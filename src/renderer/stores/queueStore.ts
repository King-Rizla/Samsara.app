import { create } from 'zustand';
import type { QueueItem, QueueStatus, ProcessingStage, QueueStatusUpdate } from '../types/cv';
import { useProjectStore } from './projectStore';

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
  updateItemId: (oldId: string, newId: string) => void;

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

  // Handle queue status updates from main process
  handleQueueStatusUpdate: (update: QueueStatusUpdate) => void;
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

  updateItemId: (oldId, newId) => set((state) => ({
    items: state.items.map((item) =>
      item.id === oldId ? { ...item, id: newId } : item
    ),
    selectedIds: new Set([...state.selectedIds].map((sid) =>
      sid === oldId ? newId : sid
    )),
    lastSelectedId: state.lastSelectedId === oldId ? newId : state.lastSelectedId,
  })),

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
    const projectId = useProjectStore.getState().activeProjectId;
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (item && item.status === 'failed') {
        updateStatus(id, 'submitted', { error: undefined });
        updateStage(id, 'Parsing...');

        try {
          // Pass activeProjectId to associate reprocessed CV with current project
          const result = await window.api.reprocessCV(item.filePath, projectId || undefined);
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
      const projectId = useProjectStore.getState().activeProjectId;

      // Load completed CVs
      const completedResult = await window.api.getAllCVs(projectId || undefined);
      const completedItems: QueueItem[] = completedResult.success && completedResult.data
        ? completedResult.data.map((cv) => ({
            id: cv.id,
            fileName: cv.file_name,
            fileType: cv.file_name.split('.').pop()?.toLowerCase() || 'unknown',
            filePath: cv.file_path || '',
            status: 'completed' as QueueStatus,
            parseConfidence: cv.parse_confidence,
            createdAt: cv.created_at,
          }))
        : [];

      // Load queued/processing CVs
      const queuedResult = await window.api.getQueuedCVs(projectId || undefined);
      const queuedItems: QueueItem[] = queuedResult.success && queuedResult.data
        ? queuedResult.data.map((cv) => ({
            id: cv.id,
            fileName: cv.file_name,
            fileType: cv.file_name.split('.').pop()?.toLowerCase() || 'unknown',
            filePath: cv.file_path,
            status: cv.status === 'queued' ? 'queued' as QueueStatus :
                    cv.status === 'processing' ? 'submitted' as QueueStatus :
                    cv.status as QueueStatus,
            stage: cv.status === 'processing' ? 'Extracting...' as ProcessingStage : undefined,
            error: cv.error_message || undefined,
            createdAt: cv.created_at,
          }))
        : [];

      // Combine and sort by createdAt (newest first)
      const allItems = [...queuedItems, ...completedItems];
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      set({ items: allItems });
    } catch (err) {
      console.error('Failed to load CVs from database:', err);
    }
  },

  handleQueueStatusUpdate: (update: QueueStatusUpdate) => {
    const { updateStatus, updateStage } = get();

    switch (update.status) {
      case 'queued':
        // Item already added via addItem, nothing to do
        break;

      case 'processing':
        // Find item and update to submitted/extracting
        updateStage(update.id, 'Extracting...');
        break;

      case 'completed':
        updateStatus(update.id, 'completed', {
          data: update.data,
          parseConfidence: update.parseConfidence,
        });
        break;

      case 'failed':
        updateStatus(update.id, 'failed', { error: update.error });
        break;
    }
  },
}));

// Expose store for E2E testing (development/test only)
if (typeof window !== 'undefined') {
  (window as unknown as { __queueStore: typeof useQueueStore }).__queueStore = useQueueStore;
}
