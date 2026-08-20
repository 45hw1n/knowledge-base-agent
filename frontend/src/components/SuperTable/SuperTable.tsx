import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useApolloClient } from "@apollo/client";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  functionalUpdate,
  ColumnPinningState,
  ColumnSizingState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

import { useTableHook } from "../../hooks/useTableHook";
import { ListInfo, SortOrder } from "../../store/useTableStore";
import {
  buildVariables,
  getColumnBackendKey,
  applyClientSideProcessing,
} from "../../lib/tableUtils";
import {
  buildInitialColumnSizing,
  getColumnWidth,
  persistColumnSizing,
} from "../../lib/columnSizingStorage";
import { SuperTableProps, SuperColumnDef } from "./SuperTable.types";
import {
  buildInitialColumnPinning,
  getPinnedColumnStyles,
  getSkeletonPinnedStyles,
  orderColumnsForPinning,
} from "./columnPinningUtils";
import { createTanStackColumns } from "./SuperTableColumns";
import { SuperTablePagination } from "./SuperTablePagination";
import { EmptyState } from "../EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/lib/ui/table";

const DEFAULT_PAGE_SIZE = 20;

function sortEquals(a: ListInfo["sort"], b: ListInfo["sort"]): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  return a.key === b.key && a.order === b.order;
}

function filtersEqual(a: ListInfo["filters"], b: ListInfo["filters"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SuperTable<TData>({
  id,
  name,
  columns,
  query,
  accessorKey,
  defaultSort,
  defaultFilter,
  defaultPageSize,
  isLoading: externalIsLoading = false,
  isRowDisabled,
  fetchDataOverride,
  variablesBuilder,
  isListInfo = true,
  emptyState = null,
}: SuperTableProps<TData>) {
  const client = useApolloClient();
  const resolvedPageSize = defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const initialListInfo = useMemo(
    (): ListInfo => ({
      page: 1,
      pageSize: resolvedPageSize,
      sort: defaultSort,
      filters: defaultFilter,
      total: 0,
    }),
    [defaultSort, defaultFilter, resolvedPageSize],
  );

  const {
    data,
    listInfo,
    initialized,
    isFetching,
    error,
    refreshVersion,
    setData,
    setListInfoPartial,
    setListInfoFull,
    setInitialized,
    setIsFetching,
    setError,
  } = useTableHook({ id, name, defaultListInfo: initialListInfo });
  const isFetchingRef = useRef(false);
  const initializedRef = useRef(initialized);
  const isFirstDefaultSortEffect = useRef(true);
  const isFirstDefaultFilterEffect = useRef(true);
  const appliedDefaultSortRef = useRef(defaultSort);
  const appliedDefaultFilterRef = useRef(defaultFilter);
  const effectAHasRunRef = useRef(false);

  useEffect(() => {
    initializedRef.current = initialized;
  }, [initialized]);

  const toFetchListInfo = useCallback(
    (info: ListInfo): ListInfo => ({
      ...info,
      page: info.page ?? 1,
      pageSize: info.pageSize ?? resolvedPageSize,
    }),
    [resolvedPageSize],
  );

  const fetchData = useCallback(
    async (currentListInfo: ListInfo) => {
      if (isFetchingRef.current) {
        return;
      }
      isFetchingRef.current = true;

      const infoToFetch = toFetchListInfo(currentListInfo);
      setListInfoPartial({
        sort: infoToFetch.sort,
        page: infoToFetch.page,
        pageSize: infoToFetch.pageSize,
      });

      setIsFetching(true);
      setError(null);

      try {
        let extracted: unknown[];
        let nextTotal: number;
        let nextPage: number;

        if (fetchDataOverride) {
          const result = await fetchDataOverride(infoToFetch);
          extracted = result.data;
          nextTotal = result.total;
          nextPage = infoToFetch.page;
        } else {
          if (!query || !accessorKey)
            throw new Error(
              "query and accessorKey are required without fetchDataOverride",
            );
          const builtVariables = variablesBuilder
            ? variablesBuilder(infoToFetch)
            : buildVariables(infoToFetch);
          const response = await client.query({
            query,
            variables: isListInfo ? builtVariables : {},
            fetchPolicy: "network-only",
          });

          const result = response.data[accessorKey];

          const hasListInfoStructure =
            result &&
            !Array.isArray(result) &&
            ("data" in result || "listInfo" in result);
          const shouldUseListInfo = isListInfo && hasListInfoStructure;

          if (shouldUseListInfo) {
            extracted = result.data;
            nextTotal =
              result.pagination?.total ??
              result.listInfo?.total ??
              result.listInfo?.totalCount ??
              0;
            nextPage = result.listInfo?.page ?? infoToFetch.page;
          } else {
            const processed = applyClientSideProcessing(
              result || [],
              infoToFetch,
            );
            extracted = processed.data;
            nextTotal = processed.total;
            nextPage = infoToFetch.page;
          }
        }

        setData(extracted || []);

        setListInfoPartial({
          total: nextTotal,
          page: nextPage,
          sort: infoToFetch.sort,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        isFetchingRef.current = false;
        setIsFetching(false);
      }
    },
    [
      accessorKey,
      client,
      fetchDataOverride,
      isListInfo,
      query,
      setData,
      setError,
      setIsFetching,
      setListInfoPartial,
      toFetchListInfo,
      variablesBuilder,
    ],
  );

  const prevFetchDataRef = useRef(fetchData);

  // Effect A: fetch on mount, when not initialized, and when listInfo filters / variablesBuilder change
  useEffect(() => {
    const runFetch = async () => {
      const fetchDataChanged = prevFetchDataRef.current !== fetchData;
      prevFetchDataRef.current = fetchData;

      const hasCachedData = initialized && data.length > 0;
      const skipRemountFetch = hasCachedData && !effectAHasRunRef.current;
      const baseInfo = initializedRef.current ? listInfo : initialListInfo;
      const fetchPage =
        fetchDataChanged && effectAHasRunRef.current ? 1 : baseInfo.page;
      effectAHasRunRef.current = true;

      if (skipRemountFetch) {
        return;
      }

      if (!initializedRef.current) {
        setListInfoFull(initialListInfo);
      }

      const infoToFetch = toFetchListInfo({
        ...(initializedRef.current ? listInfo : initialListInfo),
        page: fetchPage,
      });

      await fetchData(infoToFetch);
      if (!initializedRef.current) {
        setInitialized(true);
      }
    };

    runFetch();
    // initialListInfo intentionally omitted — init is gated by initializedRef
    // data.length intentionally omitted — refetching on data change causes duplicate fetches after pagination
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchData,
    initialized,
    listInfo.filters,
    listInfo.pageSize,
    refreshVersion,
    setInitialized,
    setListInfoFull,
    toFetchListInfo,
  ]);

  // Effect B: when defaultSort prop changes (by value), reset page and apply sort
  useEffect(() => {
    if (isFirstDefaultSortEffect.current) {
      isFirstDefaultSortEffect.current = false;
      appliedDefaultSortRef.current = defaultSort;
      return;
    }
    if (sortEquals(appliedDefaultSortRef.current, defaultSort)) {
      return;
    }
    appliedDefaultSortRef.current = defaultSort;
    void fetchData(
      toFetchListInfo({ ...listInfo, sort: defaultSort, page: 1 }),
    );
  }, [defaultSort, fetchData, listInfo, toFetchListInfo]);

  // Effect C: when defaultFilter prop changes (by value), reset page and apply filters
  useEffect(() => {
    if (isFirstDefaultFilterEffect.current) {
      isFirstDefaultFilterEffect.current = false;
      appliedDefaultFilterRef.current = defaultFilter;
      return;
    }
    if (filtersEqual(appliedDefaultFilterRef.current, defaultFilter)) {
      return;
    }
    appliedDefaultFilterRef.current = defaultFilter;
    void fetchData(
      toFetchListInfo({ ...listInfo, filters: defaultFilter, page: 1 }),
    );
  }, [defaultFilter, fetchData, listInfo, toFetchListInfo]);

  const handleSort = useCallback(
    (column: SuperColumnDef<TData, any>) => {
      if (!column.enableSorting) return;
      const backendKey = getColumnBackendKey(column);
      const currentSort = listInfo.sort;
      const nextOrder: SortOrder =
        currentSort?.key === backendKey
          ? currentSort.order === "asc"
            ? "desc"
            : null
          : "asc";
      const updatedSort: ListInfo["sort"] = nextOrder
        ? { key: backendKey, order: nextOrder }
        : null;

      void fetchData(
        toFetchListInfo({
          ...listInfo,
          sort: updatedSort,
          page: 1,
        }),
      );
    },
    [fetchData, listInfo, toFetchListInfo],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      void fetchData(
        toFetchListInfo({
          ...listInfo,
          page: newPage,
        }),
      );
    },
    [fetchData, listInfo, toFetchListInfo],
  );

  const hasResizableColumns = useMemo(
    () => columns.some((col) => col.id != null && col.enableResizing !== false),
    [columns],
  );

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    buildInitialColumnSizing(name, columns),
  );

  const columnPinning = useMemo<ColumnPinningState>(
    () => buildInitialColumnPinning(columns),
    [columns],
  );

  const orderedColumns = useMemo(
    () => orderColumnsForPinning(columns, columnPinning),
    [columns, columnPinning],
  );

  const hasPinnedColumns = useMemo(
    () => columns.some((col) => col.isPinned),
    [columns],
  );

  const handleColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((prev) => {
        const next = functionalUpdate(updater, prev);
        persistColumnSizing(name, columns, next);
        return next;
      });
    },
    [name, columns],
  );

  const tableColumns = useMemo(() => {
    return createTanStackColumns(
      columns,
      name,
      handleSort,
      listInfo.sort?.key ?? null,
      listInfo.sort?.order ?? null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, name, listInfo.sort]);

  const table = useReactTable({
    data: data as TData[],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: hasResizableColumns,
    enableColumnPinning: hasPinnedColumns,
    columnResizeMode: "onChange",
    state: { columnSizing, columnPinning },
    onColumnSizingChange: handleColumnSizingChange,
  });

  const isLoading = externalIsLoading || isFetching;
  const skeletonPageSize = 10;

  const showLoader = !initialized || (isLoading && data?.length === 0 || !data);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive text-sm font-medium">
          Oops, something went wrong: {error}
        </div>
      )}

      <div className="relative min-w-0 overflow-x-auto rounded-lg border">
        <Table
          disableWrapper
          className={hasResizableColumns ? "table-fixed" : undefined}
          style={
            hasResizableColumns
              // min-width (the columns' own declared sum) as a floor, width:
              // 100% as the target — CSS resolves min-width over width when
              // they conflict, so the table becomes whichever is larger:
              // exactly fills its container when columns are narrower than
              // it, but still grows past it (triggering the wrapper's
              // overflow-x-auto scroll) when columns are wider — e.g. a
              // table with many columns that's meant to scroll, not get
              // squeezed to fit.
              ? { width: "100%", minWidth: table.getTotalSize() }
              : undefined
          }
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const { column } = header;
                  const isPinned = column.getIsPinned();

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(isPinned && "bg-muted")}
                      style={
                        hasResizableColumns || hasPinnedColumns
                          ? getPinnedColumnStyles(column, { isHeader: true })
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {showLoader ? (
              Array.from({ length: skeletonPageSize || 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {orderedColumns.map((col, j) => (
                    <TableCell
                      key={`skeleton-${i}-${j}`}
                      className={cn(col.isPinned && "bg-background")}
                      style={{
                        ...(hasResizableColumns && col.id
                          ? {
                              width:
                                columnSizing[col.id] ??
                                getColumnWidth(name, col),
                            }
                          : {}),
                        ...getSkeletonPinnedStyles(
                          col,
                          columns,
                          columnSizing,
                          name,
                          columnPinning,
                        ),
                      }}
                    >
                      <div className="h-5 bg-muted animate-pulse rounded-md w-full max-w-[80%]"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const disabled = isRowDisabled
                  ? isRowDisabled(row.original)
                  : false;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "group",
                      disabled && "opacity-40 pointer-events-none",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const { column } = cell;
                      const isPinned = column.getIsPinned();

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            isPinned &&
                              "bg-background group-hover:bg-[var(--muted-hover)]",
                          )}
                          style={
                            hasResizableColumns || hasPinnedColumns
                              ? getPinnedColumnStyles(column)
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <EmptyState
                    icon={emptyState?.icon}
                    message={emptyState?.message || "No results"}
                    action={emptyState?.action?.()}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <SuperTablePagination
        listInfo={listInfo}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </div>
  );
}
