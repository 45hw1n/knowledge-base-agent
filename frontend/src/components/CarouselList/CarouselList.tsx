import React, { useEffect, useRef, useCallback, useState } from "react";
import { useApolloClient } from "@apollo/client";
import "./CarouselList.css";
import { Skeleton } from "@/lib/ui/skeleton";
import { useTableHook } from "../../hooks/useTableHook";
import { ListInfo } from "../../store/useTableStore";
import {
  buildVariables,
  applyClientSideProcessing,
} from "../../lib/tableUtils";
import { CarouselListProps } from "./CarouselList.types";
import { SuperTablePagination } from "../SuperTable/SuperTablePagination";
import { EmptyState } from "../EmptyState";
import { Card, CardContent, CardHeader } from "@/lib/ui/card";

export function CarouselList<TData>({
  id,
  name,
  query,
  accessorKey,
  defaultListInfo,
  isLoading: externalIsLoading = false,
  fetchDataOverride,
  variablesBuilder,
  isListInfo = true,
  emptyState = null,
  minCardWidth,
  card: CardComponent,
}: CarouselListProps<TData>) {
  const client = useApolloClient();

  const {
    data,
    listInfo,
    initialized,
    isFetching,
    error,
    refreshVersion,
    setData,
    setListInfoPartial,
    setInitialized,
    setIsFetching,
    setError,
  } = useTableHook({ id, name, defaultListInfo });

  const isFetchingRef = useRef(false);
  const initializedRef = useRef(initialized);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMeasuredPageSizeRef = useRef<number | null>(null);
  const [layoutPageSize, setLayoutPageSize] = useState<number | null>(null);

  useEffect(() => {
    initializedRef.current = initialized;
  }, [initialized]);

  const cardMinWidth =
    typeof minCardWidth === "number" ? `${minCardWidth}px` : minCardWidth;

  const minCardWidthPx =
    typeof minCardWidth === "number"
      ? minCardWidth
      : parseInt(minCardWidth, 10);

  const getFittableCardCount = useCallback(
    (containerWidth: number): number => {
      const gap = 20;
      return Math.max(
        1,
        Math.floor((containerWidth + gap) / (minCardWidthPx + gap)),
      );
    },
    [minCardWidthPx],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const update = (width: number) => {
      if (width === 0) return;

      const newPageSize = getFittableCardCount(width);
      const pageSizeChanged = newPageSize !== lastMeasuredPageSizeRef.current;
      lastMeasuredPageSizeRef.current = newPageSize;
      setLayoutPageSize(newPageSize);
      if (pageSizeChanged) {
        setListInfoPartial({ page: 1, pageSize: newPageSize });
      }
    };

    const observer = new ResizeObserver((entries) => {
      update(entries[0].contentRect.width);
    });

    observer.observe(containerRef.current);
    update(containerRef.current.offsetWidth);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFittableCardCount]);

  const fetchData = useCallback(
    async (currentListInfo: ListInfo) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      setIsFetching(true);
      setError(null);

      try {
        let extracted: unknown[];
        let nextTotal: number;
        let nextPage: number;
        let nextHasNext: boolean | undefined;
        let nextHasPrevious: boolean | undefined;
        let shouldUseListInfo = false;

        if (fetchDataOverride) {
          const result = await fetchDataOverride(currentListInfo);
          extracted = result.data;
          nextTotal = result.total;
          nextPage = currentListInfo.page;
        } else {
          if (!query || !accessorKey)
            throw new Error(
              "query and accessorKey are required without fetchDataOverride",
            );

          const builtVariables = variablesBuilder
            ? variablesBuilder(currentListInfo)
            : buildVariables(currentListInfo);

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
          shouldUseListInfo = isListInfo && hasListInfoStructure;

          if (shouldUseListInfo) {
            extracted = result.data;
            nextTotal =
              result.pagination?.total ??
              result.listInfo?.total ??
              result.listInfo?.totalCount ??
              0;
            nextPage = result.listInfo?.page ?? currentListInfo.page;
            nextHasNext = result.pagination?.hasNext;
            nextHasPrevious = result.pagination?.hasPrevious;
          } else {
            const processed = applyClientSideProcessing(
              result || [],
              currentListInfo,
            );
            extracted = processed.data;
            nextTotal = processed.total;
            nextPage = currentListInfo.page;
          }
        }

        if (
          shouldUseListInfo &&
          (!extracted || extracted.length === 0) &&
          currentListInfo.page > 1 &&
          nextHasPrevious
        ) {
          setListInfoPartial({
            page: currentListInfo.page - 1,
            total: nextTotal,
            hasNext: nextHasNext,
            hasPrevious: nextHasPrevious,
          });
          return;
        }

        setData(extracted || []);
        setListInfoPartial({
          total: nextTotal,
          page: nextPage,
          pageSize: currentListInfo.pageSize,
          hasNext: nextHasNext,
          hasPrevious: nextHasPrevious,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        isFetchingRef.current = false;
        setIsFetching(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [client, query, accessorKey, isListInfo, fetchDataOverride],
  );

  useEffect(() => {
    if (layoutPageSize === null) return;

    const effectiveListInfo = { ...listInfo, pageSize: layoutPageSize };

    const runFetch = async () => {
      await fetchData(effectiveListInfo);
      if (!initializedRef.current) {
        setInitialized(true);
      }
    };
    runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutPageSize, listInfo.page, refreshVersion, fetchData]);

  const handlePageChange = (newPage: number) => {
    setListInfoPartial({ page: newPage });
  };

  const isLoading = externalIsLoading || isFetching;
  const skeletonCount = layoutPageSize ?? listInfo.pageSize ?? 6;

  const renderLoading = () =>
    Array.from({ length: skeletonCount }).map((_, i) => (
      <div
        key={`skeleton-${i}`}
        className="h-[300px] bg-muted/60 animate-pulse rounded-lg rounded-xl border bg-card text-card-foreground shadow"
      >
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ));

  const renderError = () => (
    <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive text-sm font-medium">
      Oops, something went wrong: {error}
    </div>
  );

  const renderEmpty = () => (
    <div className="w-full h-24 flex items-center justify-center">
      <EmptyState
        icon={emptyState?.icon}
        message={emptyState?.message || "No results"}
        action={emptyState?.action?.()}
      />
    </div>
  );

  const renderData = () =>
    (data as TData[]).map((item, i) => (
      <div key={i}>
        <CardComponent data={item} />
      </div>
    ));

  const gridStyle = {
    "--carousel-card-min-width": cardMinWidth,
  } as React.CSSProperties;

  const renderBody = () => {
    if (error) {
      return <div className="w-full">{renderError()}</div>;
    }
    if (!initialized || (isLoading && data.length === 0)) {
      return (
        <div className="carousel-grid" style={gridStyle}>
          {renderLoading()}
        </div>
      );
    }
    if (data.length === 0) {
      return <div className="w-full">{renderEmpty()}</div>;
    }
    return (
      <div className="carousel-grid" style={gridStyle}>
        {renderData()}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative w-full min-w-0">
        {isLoading && initialized && (
          <div className="absolute inset-0 bg-background/50 z-10 pointer-events-none">
            <div className="absolute inset-0 bg-muted/20 animate-pulse transition-opacity duration-300" />
          </div>
        )}

        {renderBody()}
      </div>

      {initialized &&
        !isLoading &&
        data.length > 0 &&
        (listInfo.hasNext || listInfo.hasPrevious) && (
          <SuperTablePagination
            listInfo={listInfo}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}
    </div>
  );
}
