import type { TransactionListCondition } from "./TransactionList";

const notDeletedCondition: TransactionListCondition = {
  attribute: "isDeleted",
  operator: "isNot",
  value: true,
};

export function buildTransactionExportConditions(
  periodCondition: TransactionListCondition | null,
  includePrivateTransactions = false,
): TransactionListCondition | null {
  if (!periodCondition) return null;

  const operands: TransactionListCondition[] = [notDeletedCondition];

  if (!includePrivateTransactions) {
    operands.push({ attribute: "isPrivate", operator: "is", value: false });
  }

  operands.push(periodCondition);

  return {
    operator: "AND",
    operands,
  };
}

export const TRANSACTION_EXPORT_SORT = [
  { attribute: "date", order: "DESC" as const },
];
