import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Trash2 } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { ConfirmationModal } from "@/components/common/confirmation-modal";
import { toast } from "sonner";
import { refreshTransactions } from "./refreshTransactions";
import { DELETE_TRANSACTION } from "./transaction.types";

type DeleteTransactionProps = {
  transactionId: string;
  onCompleted?: () => void;
};

export function DeleteTransaction({
  transactionId,
  onCompleted,
}: DeleteTransactionProps) {
  const [open, setOpen] = useState(false);

  const [deleteTransaction] = useMutation(DELETE_TRANSACTION, {
    onCompleted: (data) => {
      if (data.deleteTransaction.success) {
        toast.success("Transaction deleted successfully");
        setOpen(false);
        refreshTransactions();
        onCompleted?.();
      } else {
        toast.error(
          data.deleteTransaction.error?.message ||
            "Failed to delete transaction",
        );
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
  });

  const handleDelete = async () => {
    await deleteTransaction({
      variables: {
        input: { transactionId },
      },
    });
  };

  return (
    <>
      <Button
        variant="destructive"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <ConfirmationModal
        open={open}
        title="Are you sure you want to delete this transaction"
        message="Are you sure want to proceed with the operation? Once done this can't be undone"
        onCancel={() => setOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
