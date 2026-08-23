import { create } from "zustand";
import { getPendingCreationIds, addPendingCreationId, removePendingCreationId } from "@/lib/pendingCreations";

// Mirrors sessionStorage's pending-creationIds array in reactive state —
// sessionStorage itself isn't reactive, so ManualIngestionPoller needs this
// store to notice a new submission (or a completion) without a page reload.
// Every mutation here goes through the sessionStorage helpers first, so the
// two stay in sync and a page refresh still picks up whatever was pending.

interface PendingCreationsState {
  pendingIds: string[];
  hydrate: () => void;
  addPending: (creationId: string) => void;
  removePending: (creationId: string) => void;
}

export const usePendingCreationsStore = create<PendingCreationsState>((set) => ({
  pendingIds: getPendingCreationIds(),

  hydrate: () => set({ pendingIds: getPendingCreationIds() }),

  addPending: (creationId) => set({ pendingIds: addPendingCreationId(creationId) }),

  removePending: (creationId) => set({ pendingIds: removePendingCreationId(creationId) }),
}));
