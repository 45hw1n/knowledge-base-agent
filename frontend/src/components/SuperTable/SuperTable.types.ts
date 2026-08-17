import { ColumnDef } from '@tanstack/react-table';
import { DocumentNode } from 'graphql';
import { ListInfo } from '../../store/useTableStore';
import { EmptyStateConfig } from '../EmptyState';

export interface SuperColumnMeta {
  type?: 'text' | 'number' | 'date' | 'boolean' | 'currency';
  format?: (value: unknown) => string;
  badge?: Record<string, string>;
}

export type PinPosition = 'left' | 'right';

export type SuperColumnDef<TData, TValue = unknown> = Omit<ColumnDef<TData, TValue>, 'meta' | 'accessorKey' | 'enableSorting' | 'enableFiltering'> & {
  accessorKey: Extract<keyof TData, string> | string;
  /** Used as TanStack column id and localStorage key segment (`${tableName}-${id}`) */
  id?: string;
  backendKey?: string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  enableResizing?: boolean;
  /** When true, column is pinned on initial render */
  isPinned?: boolean;
  /** Which edge to pin to. Defaults to 'left' when isPinned is true. */
  pinPosition?: PinPosition;
  meta?: SuperColumnMeta;
};

export interface SuperTableProps<TData> {
  id: string;
  name: string;
  columns: SuperColumnDef<TData, any>[];
  query?: DocumentNode; // made optional for mock mode
  accessorKey?: string; // made optional for mock mode
  defaultSort: ListInfo['sort'];
  /** Stored as `listInfo.filters` in the table store */
  defaultFilter: ListInfo['filters'];
  defaultPageSize?: number;
  isLoading?: boolean;
  isRowDisabled?: (row: TData) => boolean;
  isRowSelectionDisabled?: (row: TData) => boolean;
  fetchDataOverride?: (listInfo: ListInfo) => Promise<{ data: TData[]; total: number }>;
  variablesBuilder?: (listInfo: ListInfo) => Record<string, unknown>;
  isListInfo?: boolean; // true = backend returns {data, listInfo}, false = raw array
  emptyState?: null | EmptyStateConfig;
}
