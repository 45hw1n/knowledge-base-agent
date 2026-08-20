import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import type { Entity } from "@/mocks/entities.types";
import { ticketsMock, invoicesMock, paymentsMock, eventsMock, documentsMock } from "@/mocks";
import { EntityTypeBadge } from "./entityDisplay";
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

// Both the badge row and the title text live inside `title` (rendered as
// SheetTitle/DrawerTitle, a heading) rather than splitting the badge into
// `description` — Radix renders Description as a <p>, and Badge is a <div>;
// nesting a div inside a p is invalid HTML there.
export function EntityDetailSheet({ entity, open, onOpenChange }: EntityDetailSheetProps) {
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
    >
      {entity && <EntityDetailBody entity={entity} />}
    </ResponsiveSheet>
  );
}

function EntityDetailBody({ entity }: { entity: Entity }) {
  switch (entity.type) {
    case "TICKET": {
      const ticket = ticketsMock.find((t) => t.id === entity.entityId);
      return ticket ? <TicketDetail ticket={ticket} /> : <NotFound />;
    }
    case "INVOICE": {
      const invoice = invoicesMock.find((i) => i.id === entity.entityId);
      return invoice ? <InvoiceDetail invoice={invoice} /> : <NotFound />;
    }
    case "PAYMENT": {
      const payment = paymentsMock.find((p) => p.id === entity.entityId);
      return payment ? <PaymentDetail payment={payment} /> : <NotFound />;
    }
    case "EVENT": {
      const event = eventsMock.find((e) => e.id === entity.entityId);
      return event ? <EventDetail event={event} /> : <NotFound />;
    }
    case "DOCUMENT": {
      const doc = documentsMock.find((d) => d.id === entity.entityId);
      return doc ? <DocumentDetail doc={doc} /> : <NotFound />;
    }
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return <p className="text-sm text-muted-foreground">No details found for this entity.</p>;
}
