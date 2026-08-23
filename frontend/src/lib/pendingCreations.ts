const STORAGE_KEY = "pendingManualIngestionIds";

function readRaw(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeRaw(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export function getPendingCreationIds(): string[] {
  return readRaw();
}

// Preserves existing entries — a new submission is appended, never
// overwrites what's already pending.
export function addPendingCreationId(creationId: string): string[] {
  const existing = readRaw();
  if (existing.includes(creationId)) return existing;
  const next = [...existing, creationId];
  writeRaw(next);
  return next;
}

export function removePendingCreationId(creationId: string): string[] {
  const next = readRaw().filter((id) => id !== creationId);
  writeRaw(next);
  return next;
}
