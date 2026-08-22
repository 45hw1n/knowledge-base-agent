import { Loader2 } from "lucide-react";
import { useQuery } from "@apollo/client";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import type { Entity, Invoice, Payment, Ticket, CalendarEvent, KnowledgeDocument } from "@/mocks/entities.types";
import { GET_ENTITY_DETAIL } from "@/graphql/query/entities/entitiesQueries";
import { EntityTypeBadge } from "./entityDisplay";
import { SourceFooter } from "./details/shared";
import { TicketDetail } from "./details/TicketDetail";
import { InvoiceDetail } from "./details/InvoiceDetail";
import { PaymentDetail } from "./details/PaymentDetail";
import { EventDetail } from "./details/EventDetail";
import { DocumentDetail } from "./details/DocumentDetail";

interface EntityDetailSheetProps {
  entity: Entity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The union response is discriminated by __typename (the GraphQL type name,
// e.g. "Invoice"/"Event"), not `entity.type` (the lightweight registry's
// enum value, e.g. "INVOICE"/"EVENT") — the two happen to overlap in
// meaning but are spelled differently, so __typename is what's switched on.
//
// Ticket.status/Document.summary/Document.attachments are aliased in the
// query (ticketStatus/documentSummary/documentAttachments) because GraphQL
// rejects same-named fields with different types colliding across union
// members (status: InvoiceStatus! vs TicketStatus!, etc.) — mapped back to
// the plain field names below before handing off to the detail components.
type EntityDetailResult =
  | ({ __typename: "Invoice" } & Invoice)
  | ({ __typename: "Payment" } & Payment)
  | ({ __typename: "Ticket" } & Omit<Ticket, "status"> & { ticketStatus: Ticket["status"] })
  | ({ __typename: "Event" } & CalendarEvent)
  | ({ __typename: "Document" } & Omit<KnowledgeDocument, "summary" | "attachments"> & {
        documentSummary: KnowledgeDocument["summary"];
        documentAttachments: KnowledgeDocument["attachments"];
      });

// Both the badge row and the title text live inside `title` (rendered as
// SheetTitle/DrawerTitle, a heading) rather than splitting the badge into
// `description` — Radix renders Description as a <p>, and Badge is a <div>;
// nesting a div inside a p is invalid HTML there.
export function EntityDetailSheet({ entity, open, onOpenChange }: EntityDetailSheetProps) {
  const { data, loading } = useQuery<{ entityDetail: EntityDetailResult | null }>(GET_ENTITY_DETAIL, {
    variables: { id: entity?.id ?? "" },
    skip: !entity || !open,
    fetchPolicy: "network-only",
  });

  const detail = open ? data?.entityDetail : undefined;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        entity && (
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <EntityTypeBadge type={entity.type} />
              <span className="font-mono text-xs font-normal text-muted-foreground">#{entity.displayId}</span>
            </span>
            <span>{entity.title}</span>
          </span>
        )
      }
      // Pinned outside the scrollable content (see ResponsiveSheet) — the
      // same "View original source" link every typed entity carries,
      // always visible regardless of scroll position.
      footer={
        detail && (
          <SourceFooter sourceUrl={detail.sourceUrl} createdAt={detail.createdAt} updatedAt={detail.updatedAt} />
        )
      }
    >
      {entity && open && <EntityDetailBody loading={loading} detail={detail} />}
    </ResponsiveSheet>
  );
}

function EntityDetailBody({ loading, detail }: { loading: boolean; detail: EntityDetailResult | null | undefined }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!detail) return <NotFound />;

  switch (detail.__typename) {
    case "Ticket":
      return <TicketDetail ticket={{ ...detail, status: detail.ticketStatus }} />;
    case "Invoice":
      return <InvoiceDetail invoice={detail} />;
    case "Payment":
      return <PaymentDetail payment={detail} />;
    case "Event":
      return <EventDetail event={detail} />;
    case "Document":
      return (
        <DocumentDetail
          doc={{ ...detail, summary: detail.documentSummary, attachments: detail.documentAttachments }}
        />
      );
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return <p className="text-sm text-muted-foreground">No details found for this entity.</p>;
}
