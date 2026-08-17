import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Pen } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Modal } from "@/lib/ui/modal";
import { toast } from "sonner";
import { toAttachmentItems } from "@/features/attachments/utils";
import { useAttachmentUploader } from "@/features/attachments/hooks/useAttachmentUploader";
import { MAX_ATTACHMENTS_PER_ENTITY } from "@/features/attachments/constants";
import { refreshTransactions } from "./refreshTransactions";
import { TransactionReviewCard } from "./TransactionReviewCard";
import { mapTransactionToReviewCard } from "./mapTransactionToReviewCard";
import { toEditTransactionChanges } from "./transactionMutation.utils";
import {
  EDIT_TRANSACTION,
  Transaction,
} from "./transaction.types";
import { TransactionToReview } from "./transactionReview.types";

type EditTransactionProps = {
  transaction: Transaction;
  onCompleted?: () => void;
};

export function EditTransaction({
  transaction,
  onCompleted,
}: EditTransactionProps) {
  const [open, setOpen] = useState(false);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
  const [editTransaction] = useMutation(EDIT_TRANSACTION);
  const attachmentUploader = useAttachmentUploader({
    entityType: "TRANSACTION",
    entityId: transaction.id,
    maxAttachments: MAX_ATTACHMENTS_PER_ENTITY,
    initialAttachments: transaction.attachments ?? [],
    onUploadSuccess: () => {
      refreshTransactions();
    },
  });
  const deletedAttachmentIdSet = new Set(deletedAttachmentIds);
  const visibleAttachmentItems = attachmentUploader.items.filter(
    (item) =>
      item.status !== "FAILED" &&
      (!item.attachmentId || !deletedAttachmentIdSet.has(item.attachmentId)),
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDeletedAttachmentIds([]);
    }
    setOpen(nextOpen);
  }

  function handleRemoveAttachment(attachmentId: string) {
    setDeletedAttachmentIds((current) =>
      current.includes(attachmentId)
        ? current
        : [...current, attachmentId],
    );
  }

  async function handleSave(
    _id: string,
    changes?: Partial<TransactionToReview>,
  ): Promise<boolean> {
    const mutationChanges = toEditTransactionChanges(changes);
    if (!mutationChanges && deletedAttachmentIds.length === 0) {
      handleOpenChange(false);
      return true;
    }

    try {
      const { data: result } = await editTransaction({
        variables: {
          input: {
            transactionId: transaction.id,
            changes: mutationChanges ?? {},
            deleteAttachments: deletedAttachmentIds,
          },
        },
      });

      const payload = result?.editTransaction;
      if (payload?.success) {
        toast.success(
          payload.transaction?.displayId
            ? `Updated ${payload.transaction.displayId}`
            : "Transaction updated",
        );
        attachmentUploader.removeItemsLocally(deletedAttachmentIds);
        setDeletedAttachmentIds([]);
        setOpen(false);
        refreshTransactions();
        onCompleted?.();
        return true;
      }

      toast.error(payload?.error?.message ?? "Failed to update transaction");
      return false;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update transaction",
      );
      return false;
    }
  }

  const activator = (
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <Pen className="h-4 w-4" />
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange} activator={activator}>
      <TransactionReviewCard
        key={transaction.id}
        data={mapTransactionToReviewCard(transaction)}
        variant="transaction"
        attachmentItems={
          open
            ? visibleAttachmentItems
            : toAttachmentItems(transaction.attachments ?? [])
        }
        maxAttachments={
          MAX_ATTACHMENTS_PER_ENTITY - deletedAttachmentIds.length
        }
        onAddAttachmentFiles={attachmentUploader.addFiles}
        onRemoveAttachment={handleRemoveAttachment}
        initialEditMode
        onSave={handleSave}
        onCancel={() => handleOpenChange(false)}
      />
    </Modal>
  );
}
