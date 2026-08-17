import { create } from 'zustand';

export type SortOrder = 'asc' | 'desc' | null;

export interface ListInfo {
  page: number;
  pageSize: number;
  total: number;
  sort: { key: string; order: SortOrder } | null;
  filters: Record<string, unknown>;
}

export interface TableState {
  data: unknown[];
  listInfo: ListInfo;
  defaultListInfo: ListInfo; // Added to support resets
  selectedRows: string[];
  initialized: boolean;
  isFetching: boolean;
  error: string | null;
  refreshVersion: number;
}

export interface TableStore {
  tables: Record<string, TableState>;
  initializeTable: (tableKey: string, defaultListInfo: ListInfo) => void;
  setData: (tableKey: string, data: unknown[]) => void;
  setListInfoPartial: (tableKey: string, partial: Partial<ListInfo>) => void;
  setListInfoFull: (tableKey: string, listInfo: ListInfo) => void;
  setSelectedRows: (tableKey: string, ids: string[]) => void;
  setInitialized: (tableKey: string, value: boolean) => void;
  setIsFetching: (tableKey: string, value: boolean) => void;
  setError: (tableKey: string, error: string | null) => void;
  incrementRefreshVersion: (tableKey: string) => void;
  resetTable: (tableKey: string) => void;
}

export const useTableStore = create<TableStore>((set) => ({
  tables: {},
  initializeTable: (tableKey, defaultListInfo) =>
    set((state) => {
      if (state.tables[tableKey]) return state; // no-op if exists
      return {
        tables: {
          ...state.tables,
          [tableKey]: {
            data: [],
            listInfo: { ...defaultListInfo },
            defaultListInfo: { ...defaultListInfo }, // Stored as a clone reference
            selectedRows: [],
            initialized: false,
            isFetching: false,
            error: null,
            refreshVersion: 0,
          },
        },
      };
    }),
  setData: (tableKey, data) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: { ...state.tables[tableKey], data },
        },
      };
    }),
  setListInfoPartial: (tableKey, partial) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      const current = state.tables[tableKey].listInfo;
      // Bail out early if nothing actually changed (avoids new object reference
      // that would re-trigger useEffect in SuperTable)
      const hasChange = (Object.keys(partial) as (keyof ListInfo)[]).some(
        (k) => current[k] !== partial[k]
      );
      if (!hasChange) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: {
            ...state.tables[tableKey],
            listInfo: { ...current, ...partial },
          },
        },
      };
    }),
  setListInfoFull: (tableKey, listInfo) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: { ...state.tables[tableKey], listInfo },
        },
      };
    }),
  setSelectedRows: (tableKey, selectedRows) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: { ...state.tables[tableKey], selectedRows },
        },
      };
    }),
  setInitialized: (tableKey, initialized) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: { ...state.tables[tableKey], initialized },
        },
      };
    }),
  setIsFetching: (tableKey, isFetching) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: { ...state.tables[tableKey], isFetching },
        },
      };
    }),
  setError: (tableKey, error) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      return {
        tables: {
          ...state.tables,
          [tableKey]: { ...state.tables[tableKey], error },
        },
      };
    }),
  incrementRefreshVersion: (tableKey) =>
    set((state) => {
      if (!state.tables[tableKey]) return state;
      const current = state.tables[tableKey].refreshVersion ?? 0;
      return {
        tables: {
          ...state.tables,
          [tableKey]: {
            ...state.tables[tableKey],
            refreshVersion: current + 1,
          },
        },
      };
    }),
  resetTable: (tableKey) =>
    set((state) => {
      const { [tableKey]: _, ...rest } = state.tables;
      return { tables: rest };
    }),
}));

/**
 * Global utility to trigger a table refresh from anywhere.
 * Updates listInfo when reset/override is requested and increments refreshVersion
 * so SuperTable refetches from the network.
 */
export const refreshTableByKey = (
  tableKey: string,
  options?: {
    reset?: boolean;
    override?: Partial<ListInfo>;
  }
) => {
  const store = useTableStore.getState();
  const table = store.tables[tableKey];

  if (!table) return;

  let next: ListInfo;

  if (options?.reset) {
    // Reset behavior: Use defaultListInfo but force return to page 1
    next = { 
      ...table.defaultListInfo,
      page: 1 
    };
  } else {
    // Refresh behavior: Preserve current listInfo
    next = { ...table.listInfo };
  }

  // Apply optional overrides
  if (options?.override) {
    next = { ...next, ...options.override };
  }

  const listInfoChanged = (Object.keys(next) as (keyof ListInfo)[]).some(
    (k) => table.listInfo[k] !== next[k],
  );

  if (listInfoChanged) {
    store.setListInfoFull(tableKey, { ...next });
  }

  store.incrementRefreshVersion(tableKey);
};
