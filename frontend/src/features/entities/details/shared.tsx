import { ExternalLink } from "lucide-react";
import type { Person } from "@/mocks/entities.types";
import { formatDateTime } from "./format";

export function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

export function PersonLine({ person }: { person: Person | null }) {
  if (!person || (!person.name && !person.email)) return <span className="text-muted-foreground">—</span>;
  if (!person.name) return <span>{person.email}</span>;
  return (
    <span>
      {person.name}
      {person.email && <span className="text-muted-foreground"> · {person.email}</span>}
    </span>
  );
}

// Shared footer across all five detail views — every typed record carries
// the same source/timestamp provenance fields. Rendered by EntityDetailSheet
// as ResponsiveSheet's pinned `footer` slot (outside the scrollable content
// area), not inline at the end of each *Detail.tsx component — so it's
// always visible: sticky at the bottom on desktop, non-scrolling on mobile.
export function SourceFooter({
  sourceUrl,
  createdAt,
  updatedAt,
}: {
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        View original source
      </a>
      <span>
        Extracted {formatDateTime(createdAt)}
        {updatedAt !== createdAt ? ` · Updated ${formatDateTime(updatedAt)}` : ""}
      </span>
    </div>
  );
}
