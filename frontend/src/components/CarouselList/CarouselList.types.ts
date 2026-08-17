import { DocumentNode } from 'graphql';
import { ComponentType } from 'react';
import { EmptyStateConfig } from '../EmptyState';
import { ListInfo } from '../../store/useTableStore';

export interface CarouselListProps<TData> {
  id: string;
  name: string;
  query?: DocumentNode;
  accessorKey?: string;
  defaultListInfo: ListInfo;
  isLoading?: boolean;
  fetchDataOverride?: (listInfo: ListInfo) => Promise<{ data: TData[]; total: number }>;
  variablesBuilder?: (listInfo: ListInfo) => Record<string, unknown>;
  isListInfo?: boolean;
  emptyState?: null | EmptyStateConfig;
  minCardWidth: number | string;
  card: ComponentType<{ data: TData }>;
}
