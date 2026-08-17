import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Pen } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Modal } from "@/lib/ui/modal";
import { CreditCardForm } from "@/features/credit-cards/CreditCardForm";
import {
  UPDATE_CREDIT_CARD,
  CreditCard,
} from "@/features/credit-cards/creditCard.types";
import { refreshTableByKey } from "../../store/useTableStore";
import { toast } from "sonner";

type EditCreditCardProps = {
  card: CreditCard;
  label?: string; // default: "View"
  onCompleted?: () => void; // called after successful save
};

/**
 * EditCreditCard - A reusable trigger component that opens the CreditCardForm inside a Modal for editing.
 * Encapsulates modal state and mutation logic for updating an existing credit card.
 */
export function EditCreditCard({
  card,
  label,
  onCompleted,
}: EditCreditCardProps) {
  const [open, setOpen] = useState(false);

  const [updateCreditCard] = useMutation(UPDATE_CREDIT_CARD, {
    onCompleted: (data) => {
      if (data.updateCreditCard.success) {
        toast.success("Credit card updated successfully");
        setOpen(false);
        onCompleted?.();
        refreshTableByKey("creditCards__credit-cards");
      } else {
        toast.error("Failed to update credit card");
        console.error(data.updateCreditCard.error);
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
    // No need to refetch queries here as Apollo cache might handle it,
    // but refetching ensures UI is in sync if cache management isn't perfect.
    refetchQueries: ["getCreditCards"],
  });

  const activator = (
    <Button variant="ghost" size={label ? "sm" : "icon"} className="h-8 w-8">
      <Pen className="h-4 w-4" />
      {label && <span>{label}</span>}
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={setOpen} activator={activator}>
      <CreditCardForm
        mode="edit"
        initialValues={card}
        onSave={async (data) => {
          await updateCreditCard({
            variables: {
              id: card.id,
              input: data,
            },
          });
        }}
        onCancel={() => setOpen(false)}
      />
    </Modal>
  );
}
