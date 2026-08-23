import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/lib/ui/badge";
import { Button } from "@/lib/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/ui/popover";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/lib/ui/table";
import {
  DELETE_MANUAL_INGESTION_ITEM,
  GET_MANUAL_INGESTION_FAILURES,
} from "@/graphql/query/knowledge/knowledgeQueries";
import { CreateKnowledge, type EditManualEntry } from "./CreateKnowledge";
import type { EntityType } from "@/mocks/entities.types";

// Mirrors ManualIngestionPoller.tsx's polling cadence — keeps IN_PROGRESS
// rows moving to their real outcome (or dropping off once retried/fixed)
// without the user needing to refresh.
const POLL_INTERVAL_MS = 10000;

type ManualIngestionFailureStatus = "IN_PROGRESS" | "FAILED";

interface ManualIngestionFailure {
  id: string;
  type: EntityType;
  details: string;
  summary: string | null;
  status: ManualIngestionFailureStatus;
  error: { code: string; message: string } | null;
  attachments: { fileName: string; mimeType: string | null; size: number | null }[];
  createdAt: string;
}

interface GetManualIngestionFailuresResponse {
  manualIngestionFailures: ManualIngestionFailure[];
}

const STATUS_BADGE: Record<ManualIngestionFailureStatus, string> = {
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
};

export function ManualEntriesTable() {
  const [editEntry, setEditEntry] = useState<EditManualEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data, loading, refetch } = useQuery<GetManualIngestionFailuresResponse>(GET_MANUAL_INGESTION_FAILURES, {
    pollInterval: POLL_INTERVAL_MS,
    fetchPolicy: "cache-and-network",
  });
  const [deleteItem, { loading: deleting }] = useMutation(DELETE_MANUAL_INGESTION_ITEM);

  const entries = data?.manualIngestionFailures ?? [];

  const handleEdit = (entry: ManualIngestionFailure) => {
    setEditEntry({
      id: entry.id,
      type: entry.type,
      details: entry.details,
      existingAttachments: entry.attachments.map((attachment) => ({
        fileName: attachment.fileName,
        mimeType: attachment.mimeType ?? "application/octet-stream",
        size: attachment.size ?? 0,
      })),
    });
    setEditOpen(true);
  };

  const handleDelete = async (entry: ManualIngestionFailure) => {
    try {
      await deleteItem({ variables: { id: entry.id } });
      await refetch();
      toast.success("Entry deleted");
    } catch (error) {
      console.error("[ManualEntriesTable] Failed to delete entry:", error);
      toast.error("Failed to delete entry. Please try again.");
    }
  };

  if (loading && entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No failed or in-progress manual entries.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isInProgress = entry.status === "IN_PROGRESS";
            return (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {entry.id.slice(-8)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.type}</Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="line-clamp-2 text-sm">{entry.summary || entry.details}</p>
                  {entry.status === "FAILED" && entry.error?.message && (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive">{entry.error.message}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE[entry.status]}>{entry.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Edit entry"
                      disabled={isInProgress}
                      onClick={() => handleEdit(entry)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DeleteEntryButton
                      disabled={isInProgress}
                      deleting={deleting}
                      onConfirm={() => handleDelete(entry)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <CreateKnowledge
        open={editOpen}
        onOpenChange={setEditOpen}
        editEntry={editEntry}
        onRetrySuccess={() => refetch()}
      />
    </>
  );
}

// A small in-app confirm popover instead of window.confirm() — the native
// dialog blocks the page (and browser automation) entirely, and doesn't
// match the app's own styling.
function DeleteEntryButton({
  disabled,
  deleting,
  onConfirm,
}: {
  disabled: boolean;
  deleting: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          aria-label="Delete entry"
          disabled={disabled || deleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <p className="text-sm">Delete this entry permanently? This can&apos;t be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
