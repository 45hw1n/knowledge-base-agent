import React, { useMemo } from "react";
import { SuperTable } from "@/components/SuperTable";
import {
  GET_BANK_ACCOUNTS,
  BankAccount,
} from "./bankAccount.types";
import { bankAccountColumns } from "./bankAccount.columns";
import { CreateBankAccount } from "@/components/bank-account/create-bank-account";
import { useTableHook } from "@/hooks/useTableHook";
import { ListInfo } from "@/store/useTableStore";
import { LandmarkIcon } from "lucide-react";

const BANK_ACCOUNT_PAGE_SIZE = 5;
const EMPTY_FILTER: ListInfo['filters'] = {};

export function BankAccountList() {
  const defaultListInfo = useMemo(
    (): ListInfo => ({
      page: 1,
      pageSize: BANK_ACCOUNT_PAGE_SIZE,
      total: 0,
      sort: null,
      filters: {},
    }),
    [],
  );

  const { refreshTable } = useTableHook({
    id: "bank-accounts",
    name: "bankAccounts",
    defaultListInfo,
  });

  return (
    <section id="bank-accounts-section" className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            <span className="mr-2">🏦</span> Bank Accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your bank accounts.
          </p>
        </div>
        <CreateBankAccount onCompleted={() => refreshTable({ reset: true })} />
      </div>
      <SuperTable<BankAccount>
        id="bank-accounts"
        name="bankAccounts"
        columns={bankAccountColumns}
        query={GET_BANK_ACCOUNTS}
        accessorKey="getBankAccounts"
        isListInfo={false}
        defaultSort={null}
        defaultFilter={EMPTY_FILTER}
        defaultPageSize={BANK_ACCOUNT_PAGE_SIZE}
        emptyState={{
          message: "Add bank accounts to continue",
          icon: <LandmarkIcon className="h-8 w-8" />,
          action: () => {
            return (
              <CreateBankAccount
                variant="outline"
                onCompleted={() => refreshTable({ reset: true })}
              />
            );
          },
        }}
      />
    </section>
  );
}
