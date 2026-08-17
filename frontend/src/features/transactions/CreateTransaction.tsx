import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { SquarePlus } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Modal } from "@/lib/ui/modal";
import { toast } from "sonner";
import { UPLOAD_ATTACHMENTS } from "@/features/attachments/api";
import { MAX_ATTACHMENTS_PER_ENTITY } from "@/features/attachments/constants";
import { useLocalAttachmentSelection } from "@/features/attachments/hooks/useLocalAttachmentSelection";
import type { UploadAttachmentsPayload } from "@/features/attachments/types";
import { refreshTransactions } from "./refreshTransactions";
import { TransactionReviewCard } from "./TransactionReviewCard";
import { defaultCreateTransactionData } from "./defaultCreateTransactionData";
import { toCreateTransactionInput } from "./transactionMutation.utils";
import { CREATE_TRANSACTION } from "./transaction.types";
import { TransactionToReview } from "./transactionReview.types";

type CreateTransactionProps = {
  label?: string;
  icon?: React.ReactNode;
  onCompleted?: () => void;
  variant?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CreateTransaction({
  label = "Add Transaction",
  icon = <SquarePlus className="w-4 h-4" />,
  onCompleted,
  variant = "default",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateTransactionProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;
  const [createTransaction] = useMutation(CREATE_TRANSACTION);
  const [uploadAttachments] = useMutation(UPLOAD_ATTACHMENTS);
  const localAttachments = useLocalAttachmentSelection(
    MAX_ATTACHMENTS_PER_ENTITY,
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      localAttachments.reset();
    }
    setOpen(nextOpen);
  }

  async function handleCreate(
    _id: string,
    changes?: Partial<TransactionToReview>,
  ): Promise<boolean> {
    const type = changes?.type ?? "DEBIT";
    const input = toCreateTransactionInput(changes ?? {}, type);
    if (!input) {
      toast.error("Please fill in all required fields");
      return false;
    }

    try {
      const { data: result } = await createTransaction({
        variables: { input },
      });

      const payload = result?.createTransaction;
      if (payload?.success) {
        const transactionId = payload.transaction?.id;
        toast.success(
          payload.transaction?.displayId
            ? `Created ${payload.transaction.displayId}`
            : "Transaction created",
        );

        if (transactionId && localAttachments.files.length > 0) {
          try {
            const { data: uploadResult } = await uploadAttachments({
              variables: {
                input: {
                  entityType: "TRANSACTION",
                  entityId: transactionId,
                  files: localAttachments.files,
                },
              },
            });
            const uploadPayload: UploadAttachmentsPayload | undefined =
              uploadResult?.uploadAttachments;
            const failedFiles =
              uploadPayload?.files.filter((file) => file.status === "FAILED") ??
              [];
            if (failedFiles.length > 0) {
              toast.error(
                failedFiles.length === 1
                  ? `Transaction created, but "${failedFiles[0].fileName}" could not be uploaded`
                  : `Transaction created, but ${failedFiles.length} attachments could not be uploaded`,
              );
            }
          } catch {
            toast.error(
              "Transaction created, but its attachments could not be uploaded",
            );
          }
        }

        localAttachments.reset();
        setOpen(false);
        refreshTransactions({ reset: true });
        onCompleted?.();
        return true;
      }

      toast.error(payload?.error?.message ?? "Failed to create transaction");
      return false;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create transaction",
      );
      return false;
    }
  }

  const activator = isControlled ? undefined : (
    <Button variant={variant} className="flex items-center gap-2">
      {icon}
      {label}
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange} activator={activator}>
      <TransactionReviewCard
        key={open ? "create-open" : "create-closed"}
        data={defaultCreateTransactionData()}
        variant="create"
        initialEditMode
        saveLabel="Create"
        attachmentItems={localAttachments.items}
        maxAttachments={MAX_ATTACHMENTS_PER_ENTITY}
        onAddAttachmentFiles={localAttachments.addFiles}
        onRemoveAttachment={localAttachments.remove}
        onSave={handleCreate}
        onCancel={() => handleOpenChange(false)}
      />
    </Modal>
  );
}
