import { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Alert, AlertDescription, AlertTitle } from "@/lib/ui/alert";
import { Button } from "@/lib/ui/button";

const GET_APP_STATUS = gql`
  query GetAppStatusForSync {
    getAppStatus {
      emailSyncStatus
      emailLastSyncedAt
    }
  }
`;

const SYNC_EMAILS = gql`
  mutation SyncEmails {
    syncEmails {
      success
      message
      processedCount
    }
  }
`;

type GetAppStatusResponse = {
  getAppStatus: {
    emailSyncStatus: string | null;
    emailLastSyncedAt: string | null;
  };
};

type SyncEmailsResponse = {
  syncEmails: {
    success: boolean;
    message?: string | null;
    processedCount: number;
  };
};

export function SyncEmailsAlert() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; processedCount: number } | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const { data: appStatusData } = useQuery<GetAppStatusResponse>(GET_APP_STATUS, {
    pollInterval: isSyncing ? 3000 : 0,
    fetchPolicy: "network-only",
  });

  const [syncEmails] = useMutation<SyncEmailsResponse>(SYNC_EMAILS);

  const serverSyncing = appStatusData?.getAppStatus?.emailSyncStatus === "SYNC_IN_PROGRESS";

  useEffect(() => {
    if (serverSyncing && !isSyncing) {
      setIsSyncing(true);
    }
  }, [serverSyncing]);

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(() => setIsVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [result]);

  async function handleSyncNow() {
    if (isSyncing) return;

    setIsSyncing(true);
    setResult(null);
    setIsVisible(true);

    try {
      const response = await syncEmails();
      const syncResult = response.data?.syncEmails;

      setResult({
        success: Boolean(syncResult?.success),
        message: syncResult?.message || (syncResult?.success ? "Sync complete" : "Sync failed"),
        processedCount: syncResult?.processedCount ?? 0,
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Something went wrong while syncing emails",
        processedCount: 0,
      });
    } finally {
      setIsSyncing(false);
    }
  }

  if (!isVisible) {
    return null;
  }

  if (result) {
    return (
      <Alert
        className={
          result.success
            ? "border-l-4 border-emerald-500/30 border-l-emerald-500 bg-emerald-500/10 text-emerald-50"
            : "border-l-4 border-red-500/30 border-l-red-500 bg-red-500/10 text-foreground"
        }
      >
        <AlertTitle className="text-base font-semibold tracking-tight">
          {result.success ? `✅ Synced ${result.processedCount} email(s)` : "⚠️ Sync failed"}
        </AlertTitle>
        <AlertDescription className="mt-1 text-sm text-muted-foreground">
          {result.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-l-4 border-border/60 border-l-violet-500 bg-card/70 text-foreground backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-base font-semibold tracking-tight">
            📥 Sync your inbox
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-muted-foreground">
            Pull in new emails from Gmail now, instead of waiting for automatic sync.
          </AlertDescription>
        </div>
        <Button onClick={handleSyncNow} disabled={isSyncing} className="shrink-0">
          {isSyncing ? "Syncing..." : "Sync Emails"}
        </Button>
      </div>
    </Alert>
  );
}
