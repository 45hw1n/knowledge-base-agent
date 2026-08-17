import React from "react";
import { EditCreditCard } from "@/components/credit-card/edit-credit-card";
import { DeleteCreditCard } from "./DeleteCreditCard";

const CreditCardActions = ({
  card,
  onCompleted,
}: {
  card: any;
  onCompleted?: () => void;
}) => {
  return (
    <div className="flex justify-end pr-4 gap-2">
      <EditCreditCard card={card} onCompleted={onCompleted} />

      <DeleteCreditCard
        cardId={card.id || card._id}
        onCompleted={onCompleted}
      />
    </div>
  );
};

export default CreditCardActions;
