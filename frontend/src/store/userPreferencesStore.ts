import { create } from "zustand";

interface UserPreferencesState {
  userPreferences: any | null;
  setUserPreferences: (userPreferences: any | null) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>((set) => ({
  userPreferences: null,
  setUserPreferences: (userPreferences) => set({ userPreferences }),
}));
