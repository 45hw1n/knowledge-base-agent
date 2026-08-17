import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Trash2 } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { ConfirmationModal } from "@/components/common/confirmation-modal";
import { DELETE_BANK_ACCOUNT } from "./bankAccount.types";
import { toast } from "sonner";
import { refreshTableByKey } from "../../store/useTableStore";

type DeleteBankAccountProps = {
  accountId: string;
  label?: string;
  onCompleted?: () => void;
};

/**
 * DeleteBankAccount - A reusable trigger component that opens a ConfirmationModal
 * to delete a bank account.
 */
export function DeleteBankAccount({
  accountId,
  label,
  onCompleted,
}: DeleteBankAccountProps) {
  const [open, setOpen] = useState(false);

  const [deleteBankAccount] = useMutation(DELETE_BANK_ACCOUNT, {
    variables: { id: accountId },
    onCompleted: (data) => {
      if (data.deleteBankAccount.success) {
        toast.success("Bank account deleted successfully");
        setOpen(false);
        onCompleted?.();
        refreshTableByKey("bankAccounts__bank-accounts");
      } else {
        toast.error(data.deleteBankAccount.error?.message || "Failed to delete bank account");
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
    refetchQueries: ["getBankAccounts"],
  });

  const handleDelete = async () => {
    await deleteBankAccount();
  };

  return (
    <>
      <Button
        variant="destructive"
        size={label ? "sm" : "icon"}
        className={label ? "flex items-center gap-2" : "h-8 w-8"}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {label && <span>{label}</span>}
      </Button>

      <ConfirmationModal
        open={open}
        title="Are you sure you want to delete this bank account?"
        message="Are you sure want to proceed with the operation? Once done this can't be undone."
        onCancel={() => setOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
