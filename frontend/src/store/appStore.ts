import { create } from 'zustand';

export type SyncStatus = {
  emailSyncStatus: 'IDLE' | 'SYNC_IN_PROGRESS' | null;
  emailProcessingInProgress: boolean | null;
  emailLastSyncedAt: string | null;
  lastEmailAIProcessedCount: number | null;
};

interface AppState {
  user: any | null;
  appStatus: any | null;
  initialized: boolean;
  syncStatus: SyncStatus | null;

  setUser: (user: any | null) => void;
  setAppStatus: (status: any | null) => void;
  setInitialized: (initialized: boolean) => void;
  setSyncStatus: (status: SyncStatus | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  appStatus: null,
  initialized: false,
  syncStatus: null,

  setUser: (user) => set({ user }),
  setAppStatus: (appStatus) => set({ appStatus }),
  setInitialized: (initialized) => set({ initialized }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
