import type { TransactionListCondition } from "@/features/transactions/TransactionList";

const EXCLUDED_SPEND_CATEGORIES = [
  "INCOME",
  "INVESTMENT",
  "SAVING",
  "REFUND",
  "FUND_TRANSFER",
];

export function buildWidgetConditions(
  periodCondition: TransactionListCondition | null,
  showPrivateEntity = false,
): TransactionListCondition {
  const operands: TransactionListCondition[] = [
    { attribute: "isDeleted", operator: "isNot", value: true },
    { attribute: "isCreditCardRepayment", operator: "is", value: false },
    {
      attribute: "category",
      operator: "isNot",
      value: EXCLUDED_SPEND_CATEGORIES,
    },
  ];

  if (!showPrivateEntity) {
    operands.push({ attribute: "isPrivate", operator: "is", value: false });
  }

  if (periodCondition) {
    operands.push(periodCondition);
  }

  return {
    operator: "AND",
    operands,
  };
}
