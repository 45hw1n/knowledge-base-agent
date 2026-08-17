import { Transaction } from "./transaction.types";
import { TransactionToReview } from "./transactionReview.types";

export function mapTransactionToReviewCard(
  transaction: Transaction,
): TransactionToReview {
  return {
    id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    type: transaction.type,
    date: transaction.date,
    name: transaction.name,
    merchant: transaction.merchant,
    merchantRaw: transaction.merchant,
    notes: transaction.notes,
    category: transaction.category,
    subCategory: transaction.subCategory,
    cycle: transaction.cycle,
    paymentSource: transaction.paymentSource
      ? {
          kind: transaction.paymentSource.kind,
          instrumentId: transaction.paymentSource.instrumentId,
          displayName: null,
          last4: null,
          bank: null,
        }
      : null,
    paymentMode: transaction.paymentMode,
    isCreditCardRepayment: transaction.isCreditCardRepayment ?? false,
    isPrivate: transaction.isPrivate ?? false,
    status: "APPROVED",
    aiConfidence: null,
    referenceId: null,
    approvedAt: null,
    transactionId: transaction.id,
    rejectedAt: null,
    rejectionNote: null,
    attachments: transaction.attachments ?? [],
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}
