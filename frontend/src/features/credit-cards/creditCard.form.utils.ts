import type {
  CreditCardFormValues,
  CreditCardFormErrors,
  CreditCardSavePayload,
} from "./creditCard.form.types";

// ─── Default / initial values ────────────────────────────────────────────────

export const INITIAL_FORM_VALUES: CreditCardFormValues = {
  name: "",
  bank: "",
  last4: "",
  expiry: "",
  billingCycleDay: "",
  dueDateDay: "",
};

// Dropdown option constants (Months/Years/Days removed as they are replaced by numeric inputs)

// ─── Validation ──────────────────────────────────────────────────────────────

const LAST4_REGEX = /^\d{4}$/;

/**
 * Pure validation function. Returns an errors object.
 * Empty object = all fields valid.
 */
export const validate = (
  values: CreditCardFormValues,
): CreditCardFormErrors => {
  const errors: CreditCardFormErrors = {};

  // Required text fields
  if (!values.name.trim()) {
    errors.name = "Card name is required";
  }

  if (!values.bank) {
    errors.bank = "Bank is required";
  }

  // last4 — required + format
  if (!values.last4.trim()) {
    errors.last4 = "Last 4 digits are required";
  } else if (!LAST4_REGEX.test(values.last4.trim())) {
    errors.last4 = "Must be exactly 4 numeric digits";
  }

  // Expiry — optional (MMYY format)
  if (values.expiry) {
    if (values.expiry.length !== 4) {
      errors.expiry = "Must be exactly 4 digits (MM/YY)";
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
  }

  // Updated validation for days
  if (!values.billingCycleDay) {
    errors.billingCycleDay = "Billing day is required";
  } else {
    const day = Number(values.billingCycleDay);
    if (isNaN(day) || day < 1 || day > 31) {
      errors.billingCycleDay = "Must be between 1 and 31";
    }
  }

  if (!values.dueDateDay) {
    errors.dueDateDay = "Bill due day is required";
  } else {
    const day = Number(values.dueDateDay);
    if (isNaN(day) || day < 1 || day > 31) {
      errors.dueDateDay = "Must be between 1 and 31";
    }
  }

  return errors;
};

// ─── Payload builder ─────────────────────────────────────────────────────────

/**
 * Converts string-based form state to the typed payload expected by onSave.
 * Numeric coercion happens here so the form state can stay string-based for Select compatibility.
 */
export const buildPayload = (
  values: CreditCardFormValues,
): CreditCardSavePayload => {
  const payload: CreditCardSavePayload = {
    name: values.name.trim(),
    bank: values.bank.trim(),
    last4: values.last4.trim(),
    billingCycleDay: Number(values.billingCycleDay),
    dueDateDay: Number(values.dueDateDay),
  };

  if (values.expiry && values.expiry.length === 4) {
    payload.expiryMonth = parseInt(values.expiry.slice(0, 2));
    // Transform YY to 20YY
    payload.expiryYear = 2000 + parseInt(values.expiry.slice(2));
  }

  return payload;
};
