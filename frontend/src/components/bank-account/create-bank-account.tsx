import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { SquarePlus } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Modal } from "@/lib/ui/modal";
import { BankAccountForm } from "@/features/bank-accounts/BankAccountForm";
import { CREATE_BANK_ACCOUNT } from "@/features/bank-accounts/bankAccount.types";
import { toast } from "sonner";

type CreateBankAccountProps = {
  label?: string; // default: "Create"
  icon?: React.ReactNode; // default: Plus icon
  onCompleted?: () => void; // called after successful save
  variant: string
};

/**
 * CreateBankAccount - A reusable trigger component that opens the BankAccountForm inside a Modal.
 * Encapsulates modal state and mutation logic for creating a new bank account.
 */
export function CreateBankAccount({
  label = "Add Bank account",
  icon = <SquarePlus className="w-4 h-4" />,
  onCompleted,
  variant='default'
}: CreateBankAccountProps) {
  const [open, setOpen] = useState(false);

  const [createBankAccount] = useMutation(CREATE_BANK_ACCOUNT, {
    onCompleted: (data) => {
      if (data.createBankAccount.success) {
        toast.success("Bank account created successfully");
        setOpen(false);
        onCompleted?.();
      } else {
        toast.error(data.createBankAccount.error?.message || "Failed to create bank account");
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
    // Refetch the list to ensure UI is in sync
    refetchQueries: ["getBankAccounts"],
  });

  const button = (
    <Button variant={variant} className="flex items-center gap-2">
      {icon}
      {label}
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={setOpen} activator={button}>
      <BankAccountForm
        mode="create"
        onSave={async (data) => {
          await createBankAccount({
            variables: {
              input: data,
            },
          });
        }}
        onCancel={() => setOpen(false)}
      />
    </Modal>
  );
}
