import {
  CreateTransactionInput,
  EditTransactionChanges,
  TransactionCategory,
} from "./transaction.types";
import { TransactionToReview } from "./transactionReview.types";
import { ApproveTransactionChanges } from "./transactionReview.types";

function toFieldValueInput(
  field: TransactionToReview["category"] | TransactionToReview["subCategory"] | null | undefined,
): TransactionCategory | null | undefined {
  if (field === undefined) return undefined;
  if (field === null) return null;

  return {
    id: field.id ?? null,
    value: field.value ?? null,
    label: field.label ?? null,
  };
}

export function toEditTransactionChanges(
  changes?: Partial<TransactionToReview>,
): EditTransactionChanges | undefined {
  if (!changes) return undefined;

  const result: EditTransactionChanges = {};

  if (changes.name !== undefined) result.name = changes.name ?? undefined;
  if (changes.notes !== undefined) result.notes = changes.notes ?? undefined;
  if (changes.date !== undefined) result.date = changes.date ?? undefined;
  if (changes.cycle !== undefined) result.cycle = changes.cycle ?? undefined;
  if (changes.amount !== undefined) result.amount = changes.amount;
  if (changes.category !== undefined) {
    result.category = toFieldValueInput(changes.category);
  }
  if (changes.subCategory !== undefined) {
    result.subCategory = toFieldValueInput(changes.subCategory);
  }
  if (changes.paymentMode !== undefined) {
    result.paymentMode = changes.paymentMode ?? undefined;
  }

  if (changes.paymentSource) {
    result.paymentSource = {
      kind: changes.paymentSource.kind,
      instrumentId: changes.paymentSource.instrumentId,
    };
  }

  if (changes.isCreditCardRepayment !== undefined) {
    result.isCreditCardRepayment = changes.isCreditCardRepayment;
  }

  if (changes.isPrivate !== undefined) {
    result.isPrivate = changes.isPrivate;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function toApproveTransactionChanges(
  changes?: Partial<TransactionToReview>,
): ApproveTransactionChanges | undefined {
  return toEditTransactionChanges(changes) as ApproveTransactionChanges | undefined;
}

export function toCreateTransactionInput(
  changes: Partial<TransactionToReview>,
  type: string,
): CreateTransactionInput | null {
  const name = (changes.name ?? "").trim();
  const amount = changes.amount;
  const date = changes.date;
  const paymentMode = changes.paymentMode;
  const paymentSource = changes.paymentSource;

  if (
    !name ||
    amount === undefined ||
    amount === null ||
    !date ||
    !paymentMode ||
    !paymentSource?.kind ||
    !paymentSource?.instrumentId
  ) {
    return null;
  }

  const merchant = (changes.merchant ?? "").trim();

  return {
    amount,
    type,
    date,
    name,
    merchant: merchant || undefined,
    cycle: changes.cycle ?? undefined,
    category: toFieldValueInput(changes.category) ?? null,
    subCategory: toFieldValueInput(changes.subCategory) ?? null,
    paymentMode,
    paymentSource: {
      kind: paymentSource.kind,
      instrumentId: paymentSource.instrumentId,
    },
    isCreditCardRepayment: changes.isCreditCardRepayment,
    isPrivate: changes.isPrivate,
    notes: changes.notes ?? undefined,
    currency: changes.currency ?? "INR",
  };
}
