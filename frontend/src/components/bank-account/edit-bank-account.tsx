import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Pen } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Modal } from "@/lib/ui/modal";
import { BankAccountForm } from "@/features/bank-accounts/BankAccountForm";
import {
  UPDATE_BANK_ACCOUNT,
  BankAccount,
} from "@/features/bank-accounts/bankAccount.types";
import { refreshTableByKey } from "../../store/useTableStore";
import { toast } from "sonner";

type EditBankAccountProps = {
  account: BankAccount;
  label?: string; // default: "View"
  onCompleted?: () => void; // called after successful save
};

/**
 * EditBankAccount - A reusable trigger component that opens the BankAccountForm inside a Modal for editing.
 * Encapsulates modal state and mutation logic for updating an existing bank account.
 */
export function EditBankAccount({
  account,
  label,
  onCompleted,
}: EditBankAccountProps) {
  const [open, setOpen] = useState(false);

  const [updateBankAccount] = useMutation(UPDATE_BANK_ACCOUNT, {
    onCompleted: (data) => {
      if (data.updateBankAccount.success) {
        toast.success("Bank account updated successfully");
        setOpen(false);
        onCompleted?.();
        refreshTableByKey("bankAccounts__bank-accounts");
      } else {
        toast.error("Failed to update bank account");
        console.error(data.updateBankAccount.error);
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
    refetchQueries: ["getBankAccounts"],
  });

  const activator = (
    <Button variant="ghost" size={label ? "sm" : "icon"} className="h-8 w-8">
      <Pen className="h-4 w-4" />
      {label && <span>{label}</span>}
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={setOpen} activator={activator}>
      <BankAccountForm
        mode="edit"
        initialValues={account}
        onSave={async (data) => {
          await updateBankAccount({
            variables: {
              id: account.id,
              input: data,
            },
          });
        }}
        onCancel={() => setOpen(false)}
      />
    </Modal>
  );
}
