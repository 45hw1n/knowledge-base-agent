import { DropdownValue } from "@/components/common/FieldDropdown";
import { TransactionToReview } from "./transactionReview.types";

export interface EditFields {
  amount: string;
  date: Date | undefined;
  cycle: string | null;
  category: DropdownValue;
  subCategory: DropdownValue;
  paymentMode: string;
  paymentSourceId: string;
}

export type TransactionReviewFormErrors = Partial<{
  amount: string;
  merchant: string;
  category: string;
  subCategory: string;
  date: string;
  cycle: string;
  paymentSourceId: string;
  paymentMode: string;
  name: string;
}>;

const SELECT_ERROR = "required";

export function validateTransactionReviewForm(input: {
  name: string;
  merchant: string;
  editFields: EditFields;
  requireMerchant: boolean;
}): TransactionReviewFormErrors {
  const errors: TransactionReviewFormErrors = {};

  if (!input.name.trim()) {
    errors.name = "Name is required";
  }

  const amountStr = input.editFields.amount.trim();
  const amount = parseFloat(amountStr);
  if (!amountStr || Number.isNaN(amount) || amount <= 0) {
    errors.amount = "Amount is required";
  }

  if (input.requireMerchant && !input.merchant.trim()) {
    errors.merchant = "Merchant is required";
  }

  if (!input.editFields.category?.id) {
    errors.category = SELECT_ERROR;
  }

  if (!input.editFields.subCategory?.id) {
    errors.subCategory = SELECT_ERROR;
  }

  if (!input.editFields.date) {
    errors.date = SELECT_ERROR;
  }

  if (!input.editFields.cycle) {
    errors.cycle = SELECT_ERROR;
  }

  if (!input.editFields.paymentSourceId) {
    errors.paymentSourceId = SELECT_ERROR;
  }

  if (!input.editFields.paymentMode) {
    errors.paymentMode = SELECT_ERROR;
  }

  return errors;
}

export function buildTransactionChanges(
  editFields: EditFields,
  extras: {
    name: string;
    notes: string;
    merchant: string;
    isCreditCardRepayment: boolean;
    isPrivate: boolean;
    isCreateVariant: boolean;
    transactionType: string;
  },
): Partial<TransactionToReview> {
  const [psKind, psId] = editFields.paymentSourceId.split(":");

  return {
    name: extras.name.trim(),
    notes: extras.notes || undefined,
    date: editFields.date!.toISOString(),
    cycle: editFields.cycle!,
    amount: parseFloat(editFields.amount),
    category: editFields.category!,
    subCategory: editFields.subCategory!,
    paymentMode: editFields.paymentMode,
    paymentSource: {
      kind: psKind,
      instrumentId: psId,
      displayName: null,
      last4: null,
      bank: null,
    },
    isCreditCardRepayment: extras.isCreditCardRepayment,
    isPrivate: extras.isPrivate,
    ...(extras.isCreateVariant
      ? { type: extras.transactionType, merchant: extras.merchant.trim() }
      : {}),
  };
}
