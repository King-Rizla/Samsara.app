import { create } from 'zustand';

interface UsageStats {
  totalTokens: number;
  requestCount: number;
}

interface UsageState {
  // Usage data
  globalUsage: UsageStats;
  projectUsage: Record<string, UsageStats>;

  // Settings (cached from main process)
  globalTokenLimit: number | null;
  warningThreshold: number;
  llmMode: 'local' | 'cloud';

  // Loading state
  isLoading: boolean;

  // Actions
  loadUsage: () => Promise<void>;
  loadSettings: () => Promise<void>;
  isOverLimit: () => boolean;
  isNearLimit: () => boolean;
  getProjectUsage: (projectId: string) => UsageStats;
}

/**
 * Format token count with abbreviation: 1.2K, 45.3K, 1.1M
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

/**
 * Estimate cost for cloud mode tokens.
 * Based on GPT-4o-mini pricing: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
 * Using blended rate of ~$0.30 per 1M tokens (~$0.0003 per 1K tokens)
 * For local mode, returns null (no cost).
 */
export function estimateCost(tokens: number, mode: 'local' | 'cloud'): string | null {
  if (mode === 'local') return null;
  const cost = (tokens / 1_000_000) * 0.30; // $0.30 per 1M tokens
  if (cost < 0.01) return '<$0.01';
  return `~$${cost.toFixed(2)}`;
}

/**
 * Format tokens with cost estimate: "45.3K (~$0.01)"
 */
export function formatTokensWithCost(tokens: number, mode: 'local' | 'cloud'): string {
  const formatted = formatTokens(tokens);
  const cost = estimateCost(tokens, mode);
  if (cost) {
    return `${formatted} (${cost})`;
  }
  return formatted;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  globalUsage: { totalTokens: 0, requestCount: 0 },
  projectUsage: {},
  globalTokenLimit: null,
  warningThreshold: 80,
  llmMode: 'local',
  isLoading: true,

  loadUsage: async () => {
    try {
      const result = await window.api.getUsageStats();
      if (result.success && result.data) {
        set({
          globalUsage: result.data.global,
          projectUsage: result.data.byProject,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
      set({ isLoading: false });
    }
  },

  loadSettings: async () => {
    try {
      const result = await window.api.getAppSettings();
      if (result.success && result.data) {
        set({
          globalTokenLimit: result.data.globalTokenLimit ?? null,
          warningThreshold: result.data.warningThreshold,
          llmMode: result.data.llmMode,
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  isOverLimit: () => {
    const { globalUsage, globalTokenLimit } = get();
    if (globalTokenLimit === null) return false;
    return globalUsage.totalTokens >= globalTokenLimit;
  },

  isNearLimit: () => {
    const { globalUsage, globalTokenLimit, warningThreshold } = get();
    if (globalTokenLimit === null) return false;
    const threshold = (globalTokenLimit * warningThreshold) / 100;
    return globalUsage.totalTokens >= threshold && !get().isOverLimit();
  },

  getProjectUsage: (projectId: string) => {
    const { projectUsage } = get();
    return projectUsage[projectId] ?? { totalTokens: 0, requestCount: 0 };
  },
}));
