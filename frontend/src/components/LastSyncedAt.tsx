import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";

const TICK_DURATION_MS = 500;

function formatLastSyncedAt(value: string | null | undefined) {
  if (!value) return "Not synced yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not synced yet";
  return `Last synced at: ${format(parsed, "MMM d, yyyy h:mm a")}`;
}

/**
 * Passive, always-on sync status indicator — unlike SyncEmailsAlert/
 * ProcessEmailAlert (dev-only manual controls), this reflects activity
 * driven by the Gmail webhook in production: a spinner while a sync/process
 * run is in flight, a brief tick on success, then back to the plain
 * "Last synced at" label.
 *
 * Pure display — polling and the "did we just finish" edge-detection live
 * in AppInitializer (the single source of truth shared with the reactive
 * toast state machine); this component just reads useAppStore's syncStatus.
 */
export function LastSyncedAt() {
  const status = useAppStore((s) => s.syncStatus);
  const [showTick, setShowTick] = useState(false);
  const wasSyncingRef = useRef(false);

  const syncing =
    status?.emailSyncStatus === "SYNC_IN_PROGRESS" ||
    Boolean(status?.emailProcessingInProgress);

  useEffect(() => {
    if (wasSyncingRef.current && !syncing) {
      setShowTick(true);
      const timeout = setTimeout(() => setShowTick(false), TICK_DURATION_MS);
      wasSyncingRef.current = syncing;
      return () => clearTimeout(timeout);
    }
    wasSyncingRef.current = syncing;
  }, [syncing]);

  if (syncing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Syncing…</span>
      </div>
    );
  }

  if (showTick) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-500">
        <Check className="h-4 w-4" />
        <span>Synced</span>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      {formatLastSyncedAt(status?.emailLastSyncedAt)}
    </div>
  );
}
