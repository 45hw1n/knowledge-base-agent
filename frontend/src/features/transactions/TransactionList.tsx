import React, { useCallback } from "react";
import { SuperTable } from "@/components/SuperTable";
import { GET_TRANSACTIONS } from "./transaction.types";
import { transactionColumns } from "./transaction.columns";
import { CreateTransaction } from "./CreateTransaction";
import { TransactionListActions } from "./TransactionListActions";
import { ListInfo } from "@/store/useTableStore";
import { useAppStore } from "@/store/appStore";
import { ListIcon } from "lucide-react";
export interface TransactionListCondition {
  operator: string;
  attribute?: string;
  value?: unknown;
  operands?: TransactionListCondition[];
}

interface TransactionListProps {
  filterCondition?: TransactionListCondition | null;
}

const TRANSACTION_DEFAULT_SORT: ListInfo["sort"] = {
  key: "date",
  order: "desc",
};
const TRANSACTION_DEFAULT_FILTER: ListInfo["filters"] = {};

const notDeletedCondition = {
  attribute: "isDeleted",
  operator: "isNot",
  value: true,
};

function buildActiveTransactionVariables(
  listInfo: ListInfo,
  filterCondition?: TransactionListCondition | null,
  showPrivateEntity = false,
): Record<string, unknown> {
  const userFilters =
    listInfo.filters && Object.keys(listInfo.filters).length > 0
      ? (listInfo.filters as Record<string, unknown>)
      : null;

  const privateEntityCondition = !showPrivateEntity
    ? {
        attribute: "isPrivate",
        operator: "is",
        value: false,
      }
    : null;

  const operands: Array<Record<string, unknown> | TransactionListCondition> = [
    notDeletedCondition,
  ];
  if (privateEntityCondition) operands.push(privateEntityCondition);
  if (userFilters) operands.push(userFilters);
  if (filterCondition) operands.push(filterCondition);

  const conditions = {
    operator: "AND",
    operands,
  };

  return {
    input: {
      listInfo: {
        page: listInfo.page,
        pageSize: listInfo.pageSize,
        sort: listInfo.sort
          ? [
              {
                attribute: listInfo.sort.key,
                order: listInfo.sort.order.toUpperCase(),
              },
            ]
          : [],
        conditions,
      },
    },
  };
}

export function TransactionList({
  filterCondition = null,
}: TransactionListProps) {
  const showPrivateEntity = useAppStore(
    (state) => state.appStatus?.showPrivateEntity ?? false,
  );

  const variablesBuilder = useCallback(
    (listInfo: ListInfo) =>
      buildActiveTransactionVariables(
        listInfo,
        filterCondition,
        showPrivateEntity,
      ),
    [filterCondition, showPrivateEntity],
  );

  return (
    <section id="transactions-section" className="w-full min-w-0 space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Transactions</h2>
          <p className="text-sm text-muted-foreground">
            All your recorded transactions.
          </p>
        </div>
        <TransactionListActions />
      </div>
      <SuperTable
        id="transactions"
        name="transactions"
        columns={transactionColumns}
        query={GET_TRANSACTIONS}
        accessorKey="getTransactions"
        isListInfo={true}
        variablesBuilder={variablesBuilder}
        defaultSort={TRANSACTION_DEFAULT_SORT}
        defaultFilter={TRANSACTION_DEFAULT_FILTER}
        emptyState={{
          message: "No transactions found",
          icon: <ListIcon className="h-8 w-8" />,
          action: () => <CreateTransaction variant="outline" />,
        }}
      />
    </section>
  );
}
