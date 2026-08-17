import React from 'react';
import { ColumnDef, HeaderContext } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ArrowUpNarrowWide, ArrowDownWideNarrow } from 'lucide-react';
import { Badge } from '@/lib/ui/badge';
import { getColumnBackendKey } from '../../lib/tableUtils';
import { getColumnWidth } from '../../lib/columnSizingStorage';
import { SuperColumnDef, SuperColumnMeta } from './SuperTable.types';

const DEFAULT_MIN_WIDTH = 60;
const DEFAULT_MAX_WIDTH = 600;

export function renderCellContent(value: unknown, meta?: SuperColumnMeta): React.ReactNode {
  if (value === null || value === undefined) return '-';

  if (meta?.format) {
    return meta.format(value);
  }

  if (meta?.type) {
    switch (meta.type) {
      case 'date': {
        const date = new Date(value as string | number);
        if (isNaN(date.getTime())) return '-';
        return format(date, 'MMM dd, yyyy');
      }
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'currency':
        return typeof value === 'number' 
          ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value) 
          : String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'text':
      default:
        // fall through to text or badge
        break;
    }
  }

  if (meta?.badge) {
    const stringValue = String(value);
    const colorClass = meta.badge[stringValue] || 'bg-secondary text-secondary-foreground';
    return (
      <Badge className={colorClass}>
        {stringValue}
      </Badge>
    );
  }

  return String(value);
}

function ColumnResizeHandle<TData>({
  header,
}: {
  header: HeaderContext<TData, unknown>['header'];
}) {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 h-full w-[1px] cursor-col-resize select-none touch-none rounded-full bg-white opacity-30"
    />
  );
}

function renderSortableLabel<TData>(
  col: SuperColumnDef<TData, any>,
  handleSort: (column: SuperColumnDef<TData, any>) => void,
  currentSortKey: string | null,
  currentSortOrder: 'asc' | 'desc' | null,
) {
  const backendKey = getColumnBackendKey(col);
  const isSorted = currentSortKey === backendKey ? currentSortOrder : false;

  return (
    <div
      className="flex items-center space-x-1 cursor-pointer select-none group"
      onClick={() => handleSort(col)}
    >
      <span>{col.header as React.ReactNode}</span>
      <span className="w-4 h-4 flex items-center justify-center transition-colors">
        {isSorted === 'asc' ? (
          <ArrowUpNarrowWide className="w-4 h-4 text-foreground opacity-50" />
        ) : isSorted === 'desc' ? (
          <ArrowDownWideNarrow className="w-4 h-4 text-foreground opacity-50" />
        ) : (
          <ArrowDownWideNarrow className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity text-muted-foreground" />
        )}
      </span>
    </div>
  );
}

export function createTanStackColumns<TData>(
  superColumns: SuperColumnDef<TData, any>[],
  tableName: string,
  handleSort: (column: SuperColumnDef<TData, any>) => void,
  currentSortKey: string | null,
  currentSortOrder: 'asc' | 'desc' | null,
): ColumnDef<TData, any>[] {
  return superColumns.map((col) => {
    const canResize = col.id != null && col.enableResizing !== false;

    return {
      id: col.id,
      accessorKey: col.accessorKey,
      size: col.id ? getColumnWidth(tableName, col) : undefined,
      minSize: col.minWidth ?? DEFAULT_MIN_WIDTH,
      maxSize: col.maxWidth ?? DEFAULT_MAX_WIDTH,
      enableResizing: canResize,
      enablePinning: !!col.isPinned,
      header: (context) => {
        const { header } = context;
        const label = col.enableSorting
          ? renderSortableLabel(col, handleSort, currentSortKey, currentSortOrder)
          : (col.header as React.ReactNode);

        if (!canResize) {
          return label;
        }

        return (
          <div className="relative pr-1">
            {label}
            <ColumnResizeHandle header={header} />
          </div>
        );
      },
      cell: (info: any) => {
        if (typeof col.cell === 'function') {
          return col.cell(info);
        }
        return renderCellContent(info.getValue(), col.meta);
      },
    } as ColumnDef<TData, any>;
  });
}
