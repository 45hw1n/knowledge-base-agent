import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { Trash2 } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { ConfirmationModal } from "@/components/common/confirmation-modal";
import { DELETE_CREDIT_CARD } from "./creditCard.types";
import { toast } from "sonner";
import { refreshTableByKey } from "../../store/useTableStore";

type DeleteCreditCardProps = {
  cardId: string;
  label?: string;
  onCompleted?: () => void;
};

/**
 * DeleteCreditCard - A reusable trigger component that opens a ConfirmationModal
 * to delete a credit card.
 */
export function DeleteCreditCard({
  cardId,
  label,
  onCompleted,
}: DeleteCreditCardProps) {
  const [open, setOpen] = useState(false);

  const [deleteCreditCard] = useMutation(DELETE_CREDIT_CARD, {
    variables: { id: cardId },
    onCompleted: (data) => {
      if (data.deleteCreditCard.success) {
        toast.success("Credit card deleted successfully");
        setOpen(false);
        onCompleted?.();
        refreshTableByKey("creditCards__credit-cards");
      } else {
        toast.error(data.deleteCreditCard.error?.message || "Failed to delete credit card");
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
    refetchQueries: ["getCreditCards"],
  });

  const handleDelete = async () => {
    await deleteCreditCard();
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
        title="Are you sure you want to delete this credit card"
        message="Are you sure want to proceed with the operation ? Once done this can't be undone"
        onCancel={() => setOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
