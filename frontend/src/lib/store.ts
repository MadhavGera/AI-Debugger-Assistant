import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Repository, AnalysisResult } from '@/types';

// ── Analysis Store ────────────────────────────────────────
interface AnalysisStore {
  // Current session
  selectedRepo: Repository | null;
  currentAnalysis: AnalysisResult | null;
  recentAnalyses: AnalysisResult[];

  // Actions
  setSelectedRepo: (repo: Repository | null) => void;
  setCurrentAnalysis: (analysis: AnalysisResult | null) => void;
  addToHistory: (analysis: AnalysisResult) => void;
  clearCurrent: () => void;
}

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set) => ({
      selectedRepo: null,
      currentAnalysis: null,
      recentAnalyses: [],

      setSelectedRepo: (repo) => set({ selectedRepo: repo }),

      setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),

      addToHistory: (analysis) =>
        set((state) => ({
          recentAnalyses: [
            analysis,
            ...state.recentAnalyses.filter((a) => a.id !== analysis.id),
          ].slice(0, 10), // Keep last 10
        })),

      clearCurrent: () => set({ currentAnalysis: null }),
    }),
    {
      name: 'ai-debugger-analysis',
      partialize: (state) => ({
        // Only persist repo selection and recent history (not full analyses)
        selectedRepo: state.selectedRepo,
        recentAnalyses: state.recentAnalyses.map((a) => ({
          id: a.id,
          repositoryId: a.repositoryId,
          rootCause: a.rootCause,
          confidence: a.confidence,
          model: a.model,
          createdAt: a.createdAt,
        })),
      }),
    }
  )
);

// ── UI Store ──────────────────────────────────────────────
interface UIStore {
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  editorFontSize: number;

  toggleSidebar: () => void;
  setEditorFontSize: (size: number) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'dark',
      editorFontSize: 13,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setEditorFontSize: (size) => set({ editorFontSize: size }),
    }),
    { name: 'ai-debugger-ui' }
  )
);
