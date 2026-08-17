import { BankAccount, DebitCard } from "./bankAccount.types";
import { BankOption } from "@/lib/constants/banks";

/** 
 * Debit card form values — mirrors the modal fields.
 * Debit card form values — mirrors the modal fields.
 * Expiry month/year are strings for easier form handling.
 */
export interface DebitCardFormValues {
  name: string;
  last4: string;
  expiry: string;
}

/** 
 * Bank account form values.
 * Standard fields + arrays for cards and UPI IDs.
 */
export interface BankAccountFormValues {
  accountName: string;
  bank: string;
  last4: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'JOINT' | '';
  debitCards: DebitCardFormValues[];
  upiIds: string[];
}

/** Parallel shape for field-level error messages */
export type BankAccountFormErrors = Partial<
  Record<keyof Omit<BankAccountFormValues, 'debitCards' | 'upiIds'>, string>
>;

/** The payload passed to onSave */
export interface BankAccountSavePayload {
  name: string;
  bank: string;
  last4: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'JOINT';
  debitCards: Array<{
    name: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  }>;
  upiIds: string[];
}

/** Component props */
export interface BankAccountFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<BankAccount>;
  onSave: (payload: BankAccountSavePayload) => Promise<void>;
  onCancel: () => void;
}
