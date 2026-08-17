import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { SquarePlus } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { Modal } from "@/lib/ui/modal";
import { CreditCardForm } from "@/features/credit-cards/CreditCardForm";
import { CREATE_CREDIT_CARD } from "@/features/credit-cards/creditCard.types";
import { toast } from "sonner";

type CreateCreditCardProps = {
  label?: string; // default: "Create"
  icon?: React.ReactNode; // default: Plus icon
  onCompleted?: () => void; // called after successful save
  variant: string
};

/**
 * CreateCreditCard - A reusable trigger component that opens the CreditCardForm inside a Modal.
 * Encapsulates modal state and mutation logic for creating a new credit card.
 */
export function CreateCreditCard({
  label = "Add Credit Card",
  icon = <SquarePlus className="w-4 h-4" />,
  onCompleted,
  variant='default'
}: CreateCreditCardProps) {
  const [open, setOpen] = useState(false);

  const [createCreditCard] = useMutation(CREATE_CREDIT_CARD, {
    onCompleted: (data) => {
      if (data.createCreditCard.success) {
        toast.success("Credit card created successfully");
        setOpen(false);
        onCompleted?.();
      } else {
        toast.error("Failed to create credit card");
        console.log(data.createCreditCard.error);
      }
    },
    onError: (error) => {
      toast.error(error.message || "An unexpected error occurred");
    },
    // Refetch the list to ensure UI is in sync
    refetchQueries: ["getCreditCards"],
  });

  const button = (
    <Button variant={variant} className="flex items-center gap-2">
      {icon}
      {label}
    </Button>
  );

  return (
    <Modal open={open} onOpenChange={setOpen} activator={button}>
      <CreditCardForm
        mode="create"
        onSave={async (data) => {
          await createCreditCard({
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
