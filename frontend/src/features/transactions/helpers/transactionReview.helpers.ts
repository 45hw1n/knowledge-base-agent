import {
  getPaymentModeLabel,
  isPaymentModeType,
} from "@/components/common/PaymentMode";

type PaymentSourceLike = {
  kind: string;
  displayName?: string | null;
  last4?: string | null;
};

export function formatAmount(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatCycle(cycle: string | null): string {
  if (!cycle) return "—";
  const [month, year] = cycle.split("-");
  if (!month || !year) return cycle;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatPaymentMode(mode: string | null): string {
  if (!mode) return "—";
  return isPaymentModeType(mode) ? getPaymentModeLabel(mode) : mode;
}

export function formatPaymentSource(ps: PaymentSourceLike | null): string {
  if (!ps) return "—";
  const name =
    ps.displayName ??
    (ps.kind === "CREDIT_CARD" ? "Credit Card" : "Bank Account");
  return ps.last4 ? `${name}  **** ${ps.last4}` : name;
}
