import { Column, ColumnPinningState, ColumnSizingState } from '@tanstack/react-table';
import { CSSProperties } from 'react';
import { getColumnWidth } from '../../lib/columnSizingStorage';
import { SuperColumnDef } from './SuperTable.types';

export function buildInitialColumnPinning<TData>(
  columns: SuperColumnDef<TData, unknown>[],
): ColumnPinningState {
  const left: string[] = [];
  const right: string[] = [];

  for (const col of columns) {
    if (!col.isPinned || !col.id) continue;
    if (col.pinPosition === 'right') {
      right.push(col.id);
    } else {
      left.push(col.id);
    }
  }

  return { left, right };
}

export function orderColumnsForPinning<TData>(
  columns: SuperColumnDef<TData, unknown>[],
  pinning: ColumnPinningState,
): SuperColumnDef<TData, unknown>[] {
  const leftIds = new Set(pinning.left ?? []);
  const rightIds = new Set(pinning.right ?? []);

  const left = columns.filter((col) => col.id && leftIds.has(col.id));
  const center = columns.filter(
    (col) => !col.id || (!leftIds.has(col.id) && !rightIds.has(col.id)),
  );
  const right = columns.filter((col) => col.id && rightIds.has(col.id));

  return [...left, ...center, ...right];
}

export function getPinnedColumnStyles<TData>(
  column: Column<TData, unknown>,
  options?: { isHeader?: boolean },
): CSSProperties {
  const isPinned = column.getIsPinned();

  if (!isPinned) {
    return { width: column.getSize() };
  }

  const isLastLeftPinned =
    isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRightPinned =
    isPinned === 'right' && column.getIsFirstColumn('right');

  return {
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    position: 'sticky',
    width: column.getSize(),
    zIndex: options?.isHeader ? 2 : 1,
    boxShadow: isLastLeftPinned
      ? 'inset -1px 0 0 hsl(var(--border))'
      : isFirstRightPinned
        ? 'inset 1px 0 0 hsl(var(--border))'
        : undefined,
  };
}

function getColumnWidthById<TData>(
  columns: SuperColumnDef<TData, unknown>[],
  columnSizing: ColumnSizingState,
  tableName: string,
  colId: string,
): number {
  const match = columns.find((col) => col.id === colId);
  if (!match) return 0;
  return columnSizing[colId] ?? getColumnWidth(tableName, match);
}

export function getSkeletonPinnedStyles<TData>(
  col: SuperColumnDef<TData, unknown>,
  columns: SuperColumnDef<TData, unknown>[],
  columnSizing: ColumnSizingState,
  tableName: string,
  pinning: ColumnPinningState,
): CSSProperties {
  if (!col.isPinned || !col.id) return {};

  const width = getColumnWidthById(columns, columnSizing, tableName, col.id);

  if (col.pinPosition === 'right') {
    const rightPinned = (pinning.right ?? []).map((id) =>
      getColumnWidthById(columns, columnSizing, tableName, id),
    );

    const indexInRight = (pinning.right ?? []).indexOf(col.id);
    let right = 0;
    for (let i = indexInRight + 1; i < rightPinned.length; i++) {
      right += rightPinned[i];
    }

    const isFirst = indexInRight === 0;

    return {
      position: 'sticky',
      right,
      zIndex: 1,
      width,
      boxShadow: isFirst ? 'inset 1px 0 0 hsl(var(--border))' : undefined,
    };
  }

  const leftPinned = (pinning.left ?? []).map((id) =>
    getColumnWidthById(columns, columnSizing, tableName, id),
  );

  const indexInLeft = (pinning.left ?? []).indexOf(col.id);
  let left = 0;
  for (let i = 0; i < indexInLeft; i++) {
    left += leftPinned[i];
  }

  const isLast = indexInLeft === leftPinned.length - 1;

  return {
    position: 'sticky',
    left,
    zIndex: 1,
    width,
    boxShadow: isLast ? 'inset -1px 0 0 hsl(var(--border))' : undefined,
  };
}
