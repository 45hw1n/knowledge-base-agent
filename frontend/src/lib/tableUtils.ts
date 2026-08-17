import { ListInfo } from '../store/useTableStore';
import { SuperColumnDef } from '../components/SuperTable/SuperTable.types';

export function getColumnBackendKey(column: SuperColumnDef<any, any>): string {
  return column.backendKey ?? column.accessorKey;
}

export function buildVariables(listInfo: ListInfo): Record<string, unknown> {
  return {
    page: listInfo.page,
    pageSize: listInfo.pageSize,
    sortKey: listInfo.sort?.key ?? null,
    sortOrder: listInfo.sort?.order ?? null,
    filters: listInfo.filters,
  };
}

export function buildTransactionListVariables(listInfo: ListInfo): Record<string, unknown> {
  return {
    input: {
      listInfo: {
        page: listInfo.page,
        pageSize: listInfo.pageSize,
        sort: listInfo.sort
          ? [{ attribute: listInfo.sort.key, order: listInfo.sort.order.toUpperCase() }]
          : [],
        conditions: Object.keys(listInfo.filters).length > 0 ? listInfo.filters : null,
      },
    },
  };
}

export function applyClientSideProcessing<TData>(data: TData[], listInfo: ListInfo): { data: TData[], total: number } {
  if (!Array.isArray(data)) return { data: [], total: 0 };

  const clonedData = [...data];

  // 1. Apply sorting safely
  if (listInfo.sort?.key) {
    const { key, order } = listInfo.sort;
    clonedData.sort((a, b) => {
      const valA = a[key as keyof TData];
      const valB = b[key as keyof TData];

      // Handle null/undefined safely
      if (valA == null && valB == null) return 0;
      if (valA == null) return order === 'asc' ? 1 : -1;
      if (valB == null) return order === 'asc' ? -1 : 1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }

      return 0; // Fallback
    });
  }

  // 2. Apply pagination
  const { page, pageSize } = listInfo;
  const startIndex = (page - 1) * pageSize;
  const paginatedData = clonedData.slice(startIndex, startIndex + pageSize);

  return {
    data: paginatedData,
    total: clonedData.length
  };
}
