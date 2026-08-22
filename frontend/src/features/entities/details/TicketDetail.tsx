import { FileText } from "lucide-react";
import { Badge } from "@/lib/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/ui/tabs";
import type { Ticket, TicketStatus } from "@/mocks/entities.types";
import { AttachmentBadge, Conversations } from "./Conversations";
import { formatDate } from "./format";
import { DetailField, DetailGrid, PersonLine, SectionHeading } from "./shared";

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  ON_HOLD: "bg-secondary text-secondary-foreground",
  RESOLVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  CLOSED: "bg-secondary text-secondary-foreground",
};

export function TicketDetail({ ticket }: { ticket: Ticket }) {
  const parent = ticket.parentTicket ?? null;
  const duplicateOf = ticket.duplicateOfTicket ?? null;

  // Ticket has no top-level attachments field of its own — attachments live
  // per conversation message (see decisions.md's "attachments belong on the
  // message, not the entity" precedent). The Attachments tab is just that
  // list flattened across every message.
  const attachments = ticket.conversation.flatMap((message) =>
    message.attachments.map((attachment) => ({ messageId: message.messageId, attachment }))
  );

  return (
    <div className="space-y-4">
      <Badge className={STATUS_BADGE[ticket.status]}>{ticket.status.replace(/_/g, " ")}</Badge>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {ticket.summary && (
            <div className="space-y-2">
              <SectionHeading>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Summary
                </span>
              </SectionHeading>
              <p className="text-sm text-muted-foreground">{ticket.summary}</p>
            </div>
          )}

          <DetailGrid>
            <DetailField label="Ticket Number">{ticket.ticketNumber ?? "—"}</DetailField>
            <DetailField label="Due Date">{formatDate(ticket.dueDate)}</DetailField>
            <DetailField label="Assignee"><PersonLine person={ticket.assignee} /></DetailField>
            <DetailField label="Requester"><PersonLine person={ticket.requester} /></DetailField>
            <DetailField label="Urgency">{ticket.urgency ?? "—"}</DetailField>
            <DetailField label="Priority">{ticket.priority ?? "—"}</DetailField>
            <DetailField label="Status">{ticket.status.replace(/_/g, " ")}</DetailField>
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
        </TabsContent>

        <TabsContent value="conversation">
          <Conversations messages={ticket.conversation} />
        </TabsContent>

        <TabsContent value="attachments">
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attachments.map(({ messageId, attachment }) => (
                <AttachmentBadge key={attachment.attachmentId} messageId={messageId} attachment={attachment} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
