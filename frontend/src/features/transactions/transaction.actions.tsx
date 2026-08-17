import React from "react";
import { Transaction } from "./transaction.types";
import { EditTransaction } from "./EditTransaction";
import { DeleteTransaction } from "./DeleteTransaction";

const TransactionActions = ({
  transaction,
  onCompleted,
}: {
  transaction: Transaction;
  onCompleted?: () => void;
}) => {
  return (
    <div className="flex justify-end pr-4 gap-2">
      <EditTransaction transaction={transaction} onCompleted={onCompleted} />
      <DeleteTransaction
        transactionId={transaction.id}
        onCompleted={onCompleted}
      />
    </div>
  );
};

export default TransactionActions;
