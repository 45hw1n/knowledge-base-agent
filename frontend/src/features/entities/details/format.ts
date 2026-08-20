import type { Money } from "@/mocks/entities.types";

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatMoney(money: Money): string {
  const currency = money.currency ?? "INR";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(money.value);
  } catch {
    // Intl throws on an unrecognized currency code — fall back to a plain
    // "CODE amount" string rather than crashing the detail sheet over it.
    return `${currency} ${money.value.toLocaleString()}`;
  }
}
