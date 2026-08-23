import { create } from "zustand";
import type { Entity } from "@/mocks/entities.types";

// A second, independent place to open EntityDetailSheet from — the
// existing one (features/entities/EntityList.tsx) is local state scoped to
// that page, which doesn't work for a toast that can fire from any route
// (e.g. the manual "Create Knowledge" completion toast). A single instance
// fed by this store is mounted globally in AppLayout.tsx. EntityList.tsx
// itself is untouched and keeps working exactly as it does today.

interface EntityDetailSheetState {
  entity: Entity | null;
  open: boolean;
  openEntity: (entity: Entity) => void;
  close: () => void;
}

export const useEntityDetailSheetStore = create<EntityDetailSheetState>((set) => ({
  entity: null,
  open: false,
  openEntity: (entity) => set({ entity, open: true }),
  close: () => set({ open: false }),
}));
