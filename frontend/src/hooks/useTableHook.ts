import { useCallback, useEffect } from 'react';
import { useTableStore, ListInfo, TableState, refreshTableByKey } from '../store/useTableStore';

export interface UseTableHookInput {
  id: string;
  name: string;
  defaultListInfo: ListInfo;
}

function getDefaultState(defaultListInfo: ListInfo): TableState {
  return {
    data: [],
    listInfo: defaultListInfo,
    defaultListInfo: { ...defaultListInfo },
    selectedRows: [],
    initialized: false,
    isFetching: false,
    error: null,
    refreshVersion: 0,
  };
}

export function useTableHook({ id, name, defaultListInfo }: UseTableHookInput) {
  const tableKey = `${name}__${id}`;

  const {
    initializeTable,
    setData: storeSetData,
    setListInfoPartial: storeSetListInfoPartial,
    setListInfoFull: storeSetListInfoFull,
    setSelectedRows: storeSetSelectedRows,
    setInitialized: storeSetInitialized,
    setIsFetching: storeSetIsFetching,
    setError: storeSetError,
  } = useTableStore.getState();

  useEffect(() => {
    initializeTable(tableKey, defaultListInfo);
    // Keep table state in store on unmount so navigating away and back reuses cached data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]); // defaultListInfo is intentionally omitted (used only once on mount)

  const tableState = useTableStore(
    (state) => state.tables[tableKey] ?? getDefaultState(defaultListInfo)
  );

  const setData = useCallback(
    (data: unknown[]) => storeSetData(tableKey, data),
    [tableKey, storeSetData],
  );
  const setListInfoPartial = useCallback(
    (partial: Partial<ListInfo>) => storeSetListInfoPartial(tableKey, partial),
    [tableKey, storeSetListInfoPartial],
  );
  const setListInfoFull = useCallback(
    (info: ListInfo) => storeSetListInfoFull(tableKey, info),
    [tableKey, storeSetListInfoFull],
  );
  const setSelectedRows = useCallback(
    (ids: string[]) => storeSetSelectedRows(tableKey, ids),
    [tableKey, storeSetSelectedRows],
  );
  const setInitialized = useCallback(
    (val: boolean) => storeSetInitialized(tableKey, val),
    [tableKey, storeSetInitialized],
  );
  const setIsFetching = useCallback(
    (val: boolean) => storeSetIsFetching(tableKey, val),
    [tableKey, storeSetIsFetching],
  );
  const setError = useCallback(
    (err: string | null) => storeSetError(tableKey, err),
    [tableKey, storeSetError],
  );
  const refreshTable = useCallback(
    (options?: { reset?: boolean; override?: Partial<ListInfo> }) =>
      refreshTableByKey(tableKey, options),
    [tableKey],
  );

  return {
    tableKey,
    data: tableState.data,
    listInfo: tableState.listInfo,
    selectedRows: tableState.selectedRows,
    initialized: tableState.initialized,
    isFetching: tableState.isFetching,
    error: tableState.error,
    refreshVersion: tableState.refreshVersion ?? 0,
    setData,
    setListInfoPartial,
    setListInfoFull,
    setSelectedRows,
    setInitialized,
    setIsFetching,
    setError,
    refreshTable,
  };
}
