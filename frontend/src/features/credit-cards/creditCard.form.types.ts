/** Form field values — mirrors CreateCreditCardInput from the GraphQL schema.
 *  Dropdown values are strings because shadcn Select emits strings via onValueChange.
 *  They are coerced to numbers at submit time inside buildPayload(). */
export interface CreditCardFormValues {
  name: string;
  bank: string;
  last4: string;
  expiry: string; // "MMYY" (e.g., "1227")
  billingCycleDay: string; // "1".."31"
  dueDateDay: string; // "1".."31"
}

/** Parallel shape for field-level error messages */
export type CreditCardFormErrors = Partial<
  Record<keyof CreditCardFormValues, string>
>;

/** The payload passed to onSave — numeric fields are coerced at submit time */
export interface CreditCardSavePayload {
  name: string;
  bank: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  billingCycleDay: number;
  dueDateDay: number;
}

/** Component props */
export interface CreditCardFormProps {
  /** Specify whether the form is for creation or editing */
  mode: "create" | "edit";
  /** Pre-populated values for edit mode. Omit for create mode. */
  initialValues?: Partial<CreditCardFormValues>;
  /** Async callback invoked with the validated payload. */
  onSave: (payload: CreditCardSavePayload) => Promise<void>;
  /** Callback to handle form cancellation/close */
  onCancel: () => void;
}
