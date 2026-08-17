import React from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { refreshTransactionWidgets } from "./refreshTransactions";
import { refreshTableByKey } from "@/store/useTableStore";
import { TransactionReviewCard } from "./TransactionReviewCard";
import {
  APPROVE_TRANSACTION,
  REJECT_TRANSACTION,
  TransactionToReview,
} from "./transactionReview.types";
import { toApproveTransactionChanges } from "./transactionMutation.utils";
import { useAttachmentUploader } from "@/features/attachments/hooks/useAttachmentUploader";
import { MAX_ATTACHMENTS_PER_ENTITY } from "@/features/attachments/constants";

const TABLE_KEY = "transactionsToReview__transactions-to-review";

export function TransactionReviewCardWithActions({
  data,
}: {
  data: TransactionToReview;
}) {
  const [approveTransaction] = useMutation(APPROVE_TRANSACTION);
  const [rejectTransaction] = useMutation(REJECT_TRANSACTION);
  const attachmentUploader = useAttachmentUploader({
    entityType: "REVIEW",
    entityId: data.id,
    maxAttachments: MAX_ATTACHMENTS_PER_ENTITY,
    initialAttachments: data.attachments,
  });

  async function runApprove(
    reviewId: string,
    changes?: Partial<TransactionToReview>,
  ): Promise<boolean> {
    try {
      const { data: result } = await approveTransaction({
        variables: {
          input: {
            reviewId,
            changes: toApproveTransactionChanges(changes),
          },
        },
      });

      const payload = result?.approveTransaction;
      if (payload?.success) {
        toast.success(
          payload.transaction?.displayId
            ? `Approved ${payload.transaction.displayId}`
            : "Transaction approved",
        );
        refreshTableByKey(TABLE_KEY);
        refreshTransactionWidgets();
        return true;
      }

      toast.error(payload?.error?.message ?? "Failed to approve transaction");
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve transaction");
      return false;
    }
  }

  async function runReject(transactionId: string, notes?: string): Promise<boolean> {
    try {
      const { data: result } = await rejectTransaction({
        variables: {
          input: {
            transactionId,
            notes: notes ?? undefined,
          },
        },
      });

      const payload = result?.rejectTransaction;
      if (payload?.success) {
        toast.success("Transaction rejected");
        refreshTableByKey(TABLE_KEY);
        refreshTransactionWidgets();
        return true;
      }

      toast.error(payload?.error?.message ?? "Failed to reject transaction");
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject transaction");
      return false;
    }
  }

  return (
    <TransactionReviewCard
      data={data}
      onApprove={(id, changes) => runApprove(id, changes)}
      onSaveAndApprove={(id, changes) => runApprove(id, changes)}
      onReject={(id, notes) => runReject(id, notes)}
      attachmentItems={attachmentUploader.items}
      maxAttachments={MAX_ATTACHMENTS_PER_ENTITY}
      onAddAttachmentFiles={attachmentUploader.addFiles}
      onRetryAttachment={attachmentUploader.retry}
      onRemoveAttachment={attachmentUploader.remove}
      onDismissFailedAttachment={attachmentUploader.dismissFailed}
    />
  );
}
