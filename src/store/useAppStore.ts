import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    // Settings
    geminiApiKey: string;
    setGeminiApiKey: (key: string) => void;

    // UI State
    isSettingsOpen: boolean;
    toggleSettings: () => void;

    // Summary Modal State
    selectedItemId: string | null;
    openSummary: (id: string) => void;
    closeSummary: () => void;

    // Phase 3 Features
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    sortOption: 'date-desc' | 'date-asc' | 'title-asc' | 'status';
    setSortOption: (opt: 'date-desc' | 'date-asc' | 'title-asc' | 'status') => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Settings
            geminiApiKey: '',
            setGeminiApiKey: (key) => set({ geminiApiKey: key }),

            // UI State
            isSettingsOpen: false,
            toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

            // Modal State
            selectedItemId: null,
            openSummary: (id) => set({ selectedItemId: id }),
            closeSummary: () => set({ selectedItemId: null }),

            // Phase 3 State
            searchQuery: '',
            setSearchQuery: (q) => set({ searchQuery: q }),
            sortOption: 'date-desc',
            setSortOption: (o) => set({ sortOption: o })
        }),
        {
            name: 'disty-vault-storage',
            // Only persist the API key to localStorage
            partialize: (state) => ({ geminiApiKey: state.geminiApiKey })
        }
    )
);
