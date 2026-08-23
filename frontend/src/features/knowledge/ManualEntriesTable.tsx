import { useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { FileWarning } from "lucide-react";
import { SuperTable } from "@/components/SuperTable";
import { ListInfo, refreshTableByKey } from "@/store/useTableStore";
import {
  DELETE_MANUAL_INGESTION_ITEM,
  GET_MANUAL_INGESTION_FAILURES,
} from "@/graphql/query/knowledge/knowledgeQueries";
import { CreateKnowledge, type EditManualEntry } from "./CreateKnowledge";
import { createManualEntriesColumns, type ManualIngestionFailure } from "./manualEntries.columns";

const EMPTY_FILTER: ListInfo["filters"] = {};
const TABLE_ID = "manualEntries";
const TABLE_KEY = `${TABLE_ID}__${TABLE_ID}`;

export function ManualEntriesTable() {
  const [editEntry, setEditEntry] = useState<EditManualEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [deleteItem, { loading: deleting }] = useMutation(DELETE_MANUAL_INGESTION_ITEM);

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
      refreshTableByKey(TABLE_KEY);
      toast.success("Entry deleted");
    } catch (error) {
      console.error("[ManualEntriesTable] Failed to delete entry:", error);
      toast.error("Failed to delete entry. Please try again.");
    }
  };

  const columns = useMemo(
    () => createManualEntriesColumns(handleEdit, handleDelete, deleting),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleting]
  );

  return (
    <>
      <SuperTable
        id={TABLE_ID}
        name={TABLE_ID}
        columns={columns}
        defaultSort={null}
        defaultFilter={EMPTY_FILTER}
        defaultPageSize={10}
        query={GET_MANUAL_INGESTION_FAILURES}
        accessorKey="manualIngestionFailures"
        isListInfo={false}
        emptyState={{
          message: "No failed or in-progress manual entries",
          icon: <FileWarning className="h-8 w-8" />,
        }}
      />

      <CreateKnowledge
        open={editOpen}
        onOpenChange={setEditOpen}
        editEntry={editEntry}
        onRetrySuccess={() => refreshTableByKey(TABLE_KEY)}
      />
    </>
  );
}
