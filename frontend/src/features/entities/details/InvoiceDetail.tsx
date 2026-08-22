import { Badge } from "@/lib/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/ui/tabs";
import type { Invoice, InvoiceStatus, PaymentLinkMethod } from "@/mocks/entities.types";
import { AttachmentBadge, Conversations } from "./Conversations";
import { formatDate, formatMoney } from "./format";
import { DetailField, DetailGrid, PersonLine, SectionHeading } from "./shared";

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  UNPAID: "bg-secondary text-secondary-foreground",
  PARTIALLY_PAID: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  OVERDUE: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
};

const LINK_METHOD_BADGE: Record<PaymentLinkMethod, string> = {
  THREAD_CONTEXT: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
  RECONCILED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  MANUAL: "bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25",
};

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const linkedPayments = invoice.linkedPayments ?? [];

  // Invoice has no top-level attachments field of its own — attachments
  // live per conversation message (see decisions.md's "attachments belong
  // on the message, not the entity" precedent). The Attachments tab is
  // just that list flattened across every message.
  const attachments = invoice.conversation.flatMap((message) =>
    message.attachments.map((attachment) => ({ messageId: message.messageId, attachment }))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_BADGE[invoice.status]}>{invoice.status.replace(/_/g, " ")}</Badge>
        <span className="text-lg font-semibold">{formatMoney(invoice.amount)}</span>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <DetailGrid>
            <DetailField label="Invoice Number">{invoice.invoiceNumber ?? "—"}</DetailField>
            <DetailField label="Due Date">{formatDate(invoice.dueDate)}</DetailField>
            <DetailField label="Issuer"><PersonLine person={invoice.issuer} /></DetailField>
          </DetailGrid>

          <div className="space-y-3">
            <SectionHeading>Payments</SectionHeading>
            {linkedPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments linked yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <div className="font-medium">{formatMoney(payment.amount)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(payment.paidAt)}</div>
                    </div>
                    {payment.linkMethod && (
                      <Badge className={LINK_METHOD_BADGE[payment.linkMethod]}>{payment.linkMethod.replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="conversation">
          <Conversations messages={invoice.conversation} />
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
