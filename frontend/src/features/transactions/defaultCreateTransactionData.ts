import { TransactionToReview } from "./transactionReview.types";

function getCurrentCycleValue(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}-${year}`;
}

export function defaultCreateTransactionData(): TransactionToReview {
  const now = new Date().toISOString();

  return {
    id: "new",
    amount: 0,
    currency: "INR",
    type: "DEBIT",
    date: now,
    name: "",
    merchant: "",
    merchantRaw: null,
    notes: null,
    category: null,
    subCategory: null,
    cycle: getCurrentCycleValue(),
    paymentSource: null,
    paymentMode: null,
    isCreditCardRepayment: false,
    isPrivate: false,
    status: "APPROVED",
    aiConfidence: null,
    referenceId: null,
    approvedAt: null,
    transactionId: null,
    rejectedAt: null,
    rejectionNote: null,
    attachments: [],
    createdAt: now,
    updatedAt: null,
  };
}
