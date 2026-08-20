import { Ticket, Receipt, Wallet, Calendar, FileText, Mail, PenLine, type LucideIcon } from "lucide-react";
import { GmailIcon } from "@/components/icons/GmailIcon";
import { Badge } from "@/lib/ui/badge";
import { cn } from "@/lib/utils";
import type { EntitySource, EntitySourceEmail, EntityType, ExtractionStatus } from "@/mocks/entities.types";

// Shared with entity.columns.tsx (table cells) and EntityDetailSheet (sheet
// header) so the type/source/status badges look identical in both places.

export const ENTITY_TYPE_CONFIG: Record<EntityType, { icon: LucideIcon; badgeClass: string }> = {
  TICKET: { icon: Ticket, badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25" },
  INVOICE: { icon: Receipt, badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25" },
  PAYMENT: { icon: Wallet, badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25" },
  EVENT: { icon: Calendar, badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25" },
  DOCUMENT: { icon: FileText, badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/25 hover:bg-rose-500/25" },
};

// Keyed on EntitySourceEmail['provider'] — only GMAIL exists today (see
// backend/src/models/Entity.js SOURCE_PROVIDERS); any provider missing from
// this map falls back to the generic "Email" icon/label.
export const SOURCE_PROVIDER_CONFIG: Record<EntitySourceEmail["provider"], { icon: LucideIcon | typeof GmailIcon; label: string }> = {
  GMAIL: { icon: GmailIcon, label: "Gmail" },
};

export const EXTRACTION_STATUS_BADGE: Record<ExtractionStatus, string> = {
  PENDING: "bg-secondary text-secondary-foreground",
  PROCESSING: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
  SUCCESS: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
};

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

export function EntityTypeBadge({ type }: { type: EntityType }) {
  const config = ENTITY_TYPE_CONFIG[type];
  if (!config) return <Badge>{type}</Badge>;
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.badgeClass)}>
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  );
}

export function EntitySourceBadge({ source }: { source: EntitySource }) {
  if (source.type === "MANUAL") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <PenLine className="h-3.5 w-3.5" />
        Manual
      </span>
    );
  }
  const provider = SOURCE_PROVIDER_CONFIG[source.provider];
  const Icon = provider?.icon ?? Mail;
  const label = provider?.label ?? "Email";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  return <Badge className={EXTRACTION_STATUS_BADGE[status] ?? "bg-secondary text-secondary-foreground"}>{status}</Badge>;
}
