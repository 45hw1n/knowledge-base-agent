import { useEffect } from "react";
import { useLazyQuery } from "@apollo/client";
import { toast } from "sonner";
import { GET_COMPLETED_ATTACHMENTS } from "@/graphql/query/knowledge/knowledgeQueries";
import { usePendingCreationsStore } from "@/store/pendingCreationsStore";
import { useEntityDetailSheetStore } from "@/store/entityDetailSheetStore";
import type { Entity, EntityType } from "@/mocks/entities.types";

// Mirrors AppInitializer.tsx's existing poll-and-toast-on-completion
// pattern (used there for email sync), applied to pending manual "Create
// Knowledge" submissions instead. Mounted once, globally, in
// routes/index.tsx — renders nothing — so completion is surfaced
// regardless of which page the user is on when it happens.
const POLL_INTERVAL_MS = 10000;

interface ManualIngestionStatusResult {
  creationId: string;
  status: "COMPLETED" | "FAILED";
  entityId: string | null;
  entityType: EntityType | null;
  displayId: string | null;
  title: string | null;
  error: { code: string; message: string } | null;
}

interface GetCompletedAttachmentsResponse {
  manualIngestionStatus: ManualIngestionStatusResult[];
}

export function ManualIngestionPoller() {
  const pendingIds = usePendingCreationsStore((s) => s.pendingIds);
  const removePending = usePendingCreationsStore((s) => s.removePending);
  const openEntity = useEntityDetailSheetStore((s) => s.openEntity);

  const [fetchStatus] = useLazyQuery<GetCompletedAttachmentsResponse>(GET_COMPLETED_ATTACHMENTS, {
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (pendingIds.length === 0) return undefined;

    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await fetchStatus({ variables: { creationIds: pendingIds } });
        if (cancelled || !data) return;

        for (const result of data.manualIngestionStatus) {
          if (result.status === "COMPLETED") {
            removePending(result.creationId);
            const canOpen = result.entityId && result.entityType && result.displayId && result.title;
            toast.success(`Entity created #${result.displayId}`, {
              closeButton: true,
              action: canOpen
                ? {
                    label: "View",
                    onClick: () =>
                      openEntity({
                        id: result.entityId,
                        type: result.entityType,
                        displayId: result.displayId,
                        title: result.title,
                      } as Entity),
                  }
                : undefined,
            });
          } else if (result.status === "FAILED") {
            removePending(result.creationId);
            toast.error("Failed to create entity. Please try again.", { closeButton: true });
          }
        }
      } catch (error) {
        console.error("[ManualIngestionPoller] Failed to poll manual ingestion status:", error);
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingIds, fetchStatus, removePending, openEntity]);

  return null;
}
