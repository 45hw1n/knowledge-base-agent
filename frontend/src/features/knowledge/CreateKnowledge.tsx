import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { Modal } from "@/lib/ui/modal";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/lib/ui/card";
import { Button } from "@/lib/ui/button";
import { Label } from "@/lib/ui/label";
import { Textarea } from "@/lib/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/lib/ui/select";
import { AttachmentUploaderButton } from "@/components/AttachmentGroup/AttachmentUploaderButton";
import { AttachmentCard } from "@/components/AttachmentGroup/AttachmentCard";
import { useLocalAttachmentSelection } from "@/features/attachments/hooks/useLocalAttachmentSelection";
import {
  CREATE_KNOWLEDGE_BASE,
  RETRY_MANUAL_INGESTION,
} from "@/graphql/query/knowledge/knowledgeQueries";
import { usePendingCreationsStore } from "@/store/pendingCreationsStore";
import type { EntityType } from "@/mocks/entities.types";

const TYPE_OPTIONS: EntityType[] = ["TICKET", "INVOICE", "PAYMENT", "EVENT", "DOCUMENT"];
const MAX_ATTACHMENTS = 5;

interface CreateKnowledgeResponse {
  createKnowledbase: { creationId: string; status: string };
}

interface RetryManualIngestionResponse {
  retryManualIngestion: { creationId: string; status: string };
}

export interface EditManualEntry {
  id: string;
  type: EntityType;
  details: string;
  // Existing, already-uploaded attachments — kept as-is on retry (there's
  // no way to drop one from the edit form, only add more). Read-only in
  // the UI: no remove button, since removing them has no local-only
  // effect until submit and would need a "keep list" the backend mutation
  // doesn't accept. See decisions.md.
  existingAttachments: { fileName: string; mimeType: string; size: number }[];
}

interface CreateKnowledgeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When set, the modal edits/retries this manual entry in place instead
  // of creating a new one — see ManualEntriesPage.tsx.
  editEntry?: EditManualEntry | null;
  onRetrySuccess?: () => void;
}

export function CreateKnowledge({ open, onOpenChange, editEntry = null, onRetrySuccess }: CreateKnowledgeProps) {
  const isEditing = Boolean(editEntry);
  const [type, setType] = useState<EntityType | "">("");
  const [details, setDetails] = useState("");
  const { items, files, addFiles, remove, reset } = useLocalAttachmentSelection(MAX_ATTACHMENTS);
  const addPending = usePendingCreationsStore((s) => s.addPending);

  const [createKnowledgebase, { loading: creating }] = useMutation<CreateKnowledgeResponse>(CREATE_KNOWLEDGE_BASE);
  const [retryManualIngestion, { loading: retrying }] =
    useMutation<RetryManualIngestionResponse>(RETRY_MANUAL_INGESTION);
  const loading = creating || retrying;

  // Pre-fill from the entry being edited every time the modal opens for
  // it — keyed on `open` too so reopening the same entry after a prior
  // edit re-syncs instead of showing stale local state.
  useEffect(() => {
    if (!open) return;
    setType(editEntry?.type ?? "");
    setDetails(editEntry?.details ?? "");
  }, [open, editEntry]);

  const resetForm = () => {
    setType("");
    setDetails("");
    reset();
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!type || !details.trim()) return;

    try {
      const creationId = editEntry
        ? await submitRetry(editEntry.id)
        : await submitCreate();
      if (!creationId) throw new Error("No creationId returned");

      // Close immediately and never wait on AI processing — the polling
      // hook picks this id up from pendingCreationsStore/sessionStorage.
      resetForm();
      onOpenChange(false);
      addPending(creationId);
      toast(isEditing ? "Retry in progress" : "Creation in progress");
      onRetrySuccess?.();
    } catch (error) {
      console.error("[CreateKnowledge] Failed to submit:", error);
      toast.error(isEditing ? "Failed to retry. Please try again." : "Failed to start creation. Please try again.");
    }
  };

  const submitCreate = async () => {
    const { data } = await createKnowledgebase({
      variables: { input: { type, details: details.trim(), attachments: files } },
    });
    return data?.createKnowledbase.creationId;
  };

  const submitRetry = async (id: string) => {
    const { data } = await retryManualIngestion({
      variables: { id, input: { type, details: details.trim(), attachments: files } },
    });
    return data?.retryManualIngestion.creationId;
  };

  return (
    <Modal open={open} onOpenChange={(next) => !next && handleClose()}>
      <Card className="w-full max-w-lg border-none shadow-none">
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Entity" : "Create Knowledge"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="knowledge-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as EntityType)}>
              <SelectTrigger id="knowledge-type">
                <SelectValue placeholder="Select a type..." />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="knowledge-details">Details</Label>
            <Textarea
              id="knowledge-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the information you want to add to the knowledge base..."
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <AttachmentUploaderButton
                onFilesSelected={addFiles}
                disabled={items.length + (editEntry?.existingAttachments.length ?? 0) >= MAX_ATTACHMENTS}
              />
            </div>
            {(editEntry?.existingAttachments.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1.5">
                {editEntry!.existingAttachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.fileName}
                    fileName={attachment.fileName}
                    size={attachment.size}
                    mimeType={attachment.mimeType}
                    status="SUCCESS"
                  />
                ))}
              </div>
            )}
            {items.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <AttachmentCard
                    key={item.localId}
                    fileName={item.fileName}
                    size={item.size}
                    mimeType={item.mimeType}
                    status={item.status}
                    onRemove={() => remove(item.localId)}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !type || !details.trim()}>
            {loading ? (isEditing ? "Retrying..." : "Creating...") : isEditing ? "Retry" : "Create"}
          </Button>
        </CardFooter>
      </Card>
    </Modal>
  );
}
