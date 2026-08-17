import React from "react";
import { EditBankAccount } from "@/components/bank-account/edit-bank-account";
import { DeleteBankAccount } from "./DeleteBankAccount";
import { BankAccount } from "./bankAccount.types";

const BankAccountActions = ({
  account,
  onCompleted,
}: {
  account: BankAccount;
  onCompleted?: () => void;
}) => {
  return (
    <div className="flex justify-end pr-4 gap-2">
      <EditBankAccount account={account} onCompleted={onCompleted} />

      <DeleteBankAccount
        accountId={account.id}
        onCompleted={onCompleted}
      />
    </div>
  );
};

export default BankAccountActions;
