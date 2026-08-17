import { ColumnSizingState } from '@tanstack/react-table';
import { SuperColumnDef } from '@/components/SuperTable/SuperTable.types';

const DEFAULT_COLUMN_WIDTH = 150;
const DEFAULT_MIN_WIDTH = 100;
const DEFAULT_MAX_WIDTH = 600;

function storageKey(tableName: string, colId: string): string {
  return `${tableName}-${colId}`;
}

function clampWidth(
  width: number,
  minWidth: number,
  maxWidth: number,
): number {
  return Math.min(maxWidth, Math.max(minWidth, width));
}

export function readColumnWidth(
  tableName: string,
  colId: string,
): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(storageKey(tableName, colId));
    if (stored == null) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeColumnWidth(
  tableName: string,
  colId: string,
  width: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(tableName, colId), String(width));
  } catch {
    // ignore storage errors
  }
}

export function getColumnWidth<TData>(
  tableName: string,
  col: SuperColumnDef<TData, unknown>,
): number {
  const minWidth = col.minWidth ?? DEFAULT_MIN_WIDTH;
  const maxWidth = col.maxWidth ?? DEFAULT_MAX_WIDTH;
  const defaultWidth = col.defaultWidth ?? DEFAULT_COLUMN_WIDTH;

  if (!col.id) return defaultWidth;

  const stored = readColumnWidth(tableName, col.id);
  const width = stored ?? defaultWidth;
  return clampWidth(width, minWidth, maxWidth);
}

export function buildInitialColumnSizing<TData>(
  tableName: string,
  columns: SuperColumnDef<TData, unknown>[],
): ColumnSizingState {
  const sizing: ColumnSizingState = {};

  for (const col of columns) {
    if (!col.id) continue;
    sizing[col.id] = getColumnWidth(tableName, col);
  }

  return sizing;
}

export function persistColumnSizing<TData>(
  tableName: string,
  columns: SuperColumnDef<TData, unknown>[],
  sizing: ColumnSizingState,
): void {
  for (const col of columns) {
    if (!col.id) continue;
    const width = sizing[col.id];
    if (width == null) continue;
    const minWidth = col.minWidth ?? DEFAULT_MIN_WIDTH;
    const maxWidth = col.maxWidth ?? DEFAULT_MAX_WIDTH;
    writeColumnWidth(tableName, col.id, clampWidth(width, minWidth, maxWidth));
  }
}
