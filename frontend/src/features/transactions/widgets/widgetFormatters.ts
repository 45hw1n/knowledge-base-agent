import {
  getPaymentModeLabel,
  isPaymentModeType,
} from "@/components/common/PaymentMode";

const CATEGORY_LABELS: Record<string, string> = {
  HOUSING: "Housing",
  GROCERY: "Grocery",
  BILLS: "Bills",
  DINING: "Dining",
  TRANSPORT: "Transport",
  TRAVEL: "Travel",
  SHOPPING: "Shopping",
  ENTERTAINMENT: "Entertainment",
  SUBSCRIPTION: "Subscription",
  HEALTH: "Health",
  EDUCATION: "Education",
  PETS: "Pets",
  INSURANCE: "Insurance",
  PERSONAL: "Personal",
  LOAN: "Loan",
  FUND_TRANSFER: "Fund Transfer",
  DEBTS: "Debts",
  INCOME: "Income",
  INVESTMENT: "Investment",
  SAVING: "Saving",
  REFUND: "Refund",
  UNKNOWN: "Unknown",
};

export function formatCategoryLabel(category: string): string {
  if (CATEGORY_LABELS[category]) {
    return CATEGORY_LABELS[category];
  }

  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatPaymentModeLabel(mode: string): string {
  if (isPaymentModeType(mode)) {
    return getPaymentModeLabel(mode);
  }

  return mode
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatTrendDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatTrendTooltipDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
