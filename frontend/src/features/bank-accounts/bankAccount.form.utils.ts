import { 
  BankAccountFormValues, 
  BankAccountFormErrors, 
  BankAccountSavePayload,
  BankOption
} from "./bankAccount.form.types";
import { getBanks } from "@/lib/constants/banks";

export const INITIAL_FORM_VALUES: BankAccountFormValues = {
  accountName: "",
  bank: "",
  last4: "",
  accountType: "",
  debitCards: [],
  upiIds: [],
};

const LAST4_REGEX = /^\d{4}$/;

/**
 * Pure validation function for the main bank account fields.
 */
export const validateBankAccountForm = (
  values: BankAccountFormValues,
): BankAccountFormErrors => {
  const errors: BankAccountFormErrors = {};

  if (!values.accountName.trim()) {
    errors.accountName = "Account name is required";
  }

  if (!values.bank) {
    errors.bank = "Bank is required";
  }

  if (!values.last4.trim()) {
    errors.last4 = "Last 4 digits are required";
  } else if (!LAST4_REGEX.test(values.last4.trim())) {
    errors.last4 = "Must be exactly 4 numeric digits";
  }

  if (!values.accountType) {
    errors.accountType = "Account type is required";
  }

  return errors;
};

/**
 * Builds the final payload for the API.
 */
export const buildBankAccountPayload = (
  values: BankAccountFormValues,
): BankAccountSavePayload => {
  return {
    name: values.accountName.trim(),
    bank: values.bank,
    last4: values.last4.trim(),
    accountType: values.accountType as BankAccountSavePayload['accountType'],
    debitCards: values.debitCards.map(dc => ({
      name: dc.name.trim(),
      last4: dc.last4.trim(),
      expiryMonth: parseInt(dc.expiry.slice(0, 2)),
      expiryYear: 2000 + parseInt(dc.expiry.slice(2)),
    })),
    upiIds: values.upiIds.map(upi => upi.trim()),
  };
};

/**
 * Validates an individual debit card entry (used in the modal).
 */
export const validateDebitCard = (values: {
  name: string;
  last4: string;
  expiry: string;
}) => {
  const errors: Record<string, string> = {};

  if (!values.name.trim()) errors.name = "Name is required";
  
  if (!values.last4.trim()) {
    errors.last4 = "Last 4 is required";
  } else if (!LAST4_REGEX.test(values.last4.trim())) {
    errors.last4 = "Must be 4 digits";
  }

  if (!values.expiry || values.expiry.length !== 4) {
    errors.expiry = "Expiry (MM/YY) is required";
  } else {
    const month = parseInt(values.expiry.slice(0, 2));
    const yearShort = parseInt(values.expiry.slice(2));
    const currentYearShort = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      errors.expiry = "Invalid month (01-12)";
    } else if (yearShort < currentYearShort) {
      errors.expiry = "Year cannot be in the past";
    } else if (yearShort === currentYearShort && month < currentMonth) {
      errors.expiry = "Expiry cannot be in the past";
    }
  }

  return errors;
};
