import { create } from 'zustand';

interface AppState {
  user: any | null;
  appStatus: any | null;
  initialized: boolean;

  setUser: (user: any | null) => void;
  setAppStatus: (status: any | null) => void;
  setInitialized: (initialized: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  appStatus: null,
  initialized: false,

  setUser: (user) => set({ user }),
  setAppStatus: (appStatus) => set({ appStatus }),
  setInitialized: (initialized) => set({ initialized }),
}));
