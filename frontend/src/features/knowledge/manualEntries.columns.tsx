import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SuperColumnDef } from "@/components/SuperTable/SuperTable.types";
import { Badge } from "@/lib/ui/badge";
import { Button } from "@/lib/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/ui/popover";
import { EntityTypeBadge } from "@/features/entities/entityDisplay";
import type { EntityType } from "@/mocks/entities.types";

export type ManualIngestionFailureStatus = "IN_PROGRESS" | "FAILED";

export interface ManualIngestionFailure {
  id: string;
  type: EntityType;
  details: string;
  summary: string | null;
  status: ManualIngestionFailureStatus;
  error: { code: string; message: string } | null;
  attachments: { fileName: string; mimeType: string | null; size: number | null }[];
  createdAt: string;
}

const STATUS_BADGE: Record<ManualIngestionFailureStatus, string> = {
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
};

// A factory (not a static array) so the Actions cell can call back into
// ManualEntriesTable's edit/delete handlers — same "columns as a function
// of caller-supplied callbacks" convention as entity.columns.tsx.
export function createManualEntriesColumns(
  onEdit: (entry: ManualIngestionFailure) => void,
  onDelete: (entry: ManualIngestionFailure) => void,
  deleting: boolean
): SuperColumnDef<ManualIngestionFailure, any>[] {
  return [
    {
      id: "id",
      accessorKey: "id",
      header: "Entity ID",
      minWidth: 100,
      defaultWidth: 120,
      maxWidth: 200,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.id.slice(-8)}</span>
      ),
    },
    {
      id: "type",
      accessorKey: "type",
      header: "Type",
      enableSorting: true,
      minWidth: 120,
      defaultWidth: 140,
      maxWidth: 220,
      cell: ({ row }) => <EntityTypeBadge type={row.original.type} />,
    },
    {
      id: "summary",
      accessorKey: "summary",
      header: "Summary",
      minWidth: 300,
      defaultWidth: 420,
      maxWidth: 700,
      cell: ({ row }) => (
        <div>
          <p className="line-clamp-2 text-sm">{row.original.summary || row.original.details}</p>
          {row.original.status === "FAILED" && row.original.error?.message && (
            <p className="mt-1 line-clamp-2 text-xs text-destructive">{row.original.error.message}</p>
          )}
        </div>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      enableSorting: true,
      minWidth: 120,
      defaultWidth: 140,
      maxWidth: 220,
      cell: ({ row }) => (
        <Badge className={STATUS_BADGE[row.original.status]}>{row.original.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      id: "actions",
      accessorKey: "id",
      header: "Actions",
      enableResizing: false,
      minWidth: 100,
      defaultWidth: 110,
      maxWidth: 110,
      cell: ({ row }) => {
        const isInProgress = row.original.status === "IN_PROGRESS";
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Edit entry"
              disabled={isInProgress}
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <DeleteEntryButton
              disabled={isInProgress}
              deleting={deleting}
              onConfirm={() => onDelete(row.original)}
            />
          </div>
        );
      },
    },
  ];
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
