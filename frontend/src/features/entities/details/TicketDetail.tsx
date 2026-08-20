import { Badge } from "@/lib/ui/badge";
import type { Ticket, TicketLevel, TicketStatus } from "@/mocks/entities.types";
import { ticketsMock } from "@/mocks";
import { formatDate } from "./format";
import { ConversationThread, DetailField, DetailGrid, PersonLine, SectionHeading, SourceFooter } from "./shared";

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  ON_HOLD: "bg-secondary text-secondary-foreground",
  RESOLVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  CLOSED: "bg-secondary text-secondary-foreground",
};

const LEVEL_BADGE: Record<TicketLevel, string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
  HIGH: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
};

export function TicketDetail({ ticket }: { ticket: Ticket }) {
  const parent = ticket.parentTicketId ? ticketsMock.find((t) => t.id === ticket.parentTicketId) : null;
  const duplicateOf = ticket.duplicateOfTicketId ? ticketsMock.find((t) => t.id === ticket.duplicateOfTicketId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_BADGE[ticket.status]}>{ticket.status.replace(/_/g, " ")}</Badge>
        {ticket.urgency && <Badge className={LEVEL_BADGE[ticket.urgency]}>Urgency: {ticket.urgency}</Badge>}
        {ticket.priority && <Badge className={LEVEL_BADGE[ticket.priority]}>Priority: {ticket.priority}</Badge>}
      </div>

      {ticket.summary && <p className="text-sm text-muted-foreground">{ticket.summary}</p>}

      <DetailGrid>
        <DetailField label="Ticket Number">{ticket.ticketNumber ?? "—"}</DetailField>
        <DetailField label="Due Date">{formatDate(ticket.dueDate)}</DetailField>
        <DetailField label="Assignee"><PersonLine person={ticket.assignee} /></DetailField>
        <DetailField label="Requester"><PersonLine person={ticket.requester} /></DetailField>
      </DetailGrid>

      {(parent || duplicateOf) && (
        <div className="space-y-1 text-sm">
          {parent && (
            <p>
              <span className="text-muted-foreground">Sub-task of </span>
              {parent.title}
            </p>
          )}
          {duplicateOf && (
            <p>
              <span className="text-muted-foreground">Duplicate of </span>
              {duplicateOf.title}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <SectionHeading>Conversation</SectionHeading>
        <ConversationThread messages={ticket.conversation} />
      </div>

      <SourceFooter sourceUrl={ticket.sourceUrl} createdAt={ticket.createdAt} updatedAt={ticket.updatedAt} />
    </div>
  );
}
