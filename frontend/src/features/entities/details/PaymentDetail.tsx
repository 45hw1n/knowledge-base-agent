import { Badge } from "@/lib/ui/badge";
import type { Payment, PaymentLinkMethod, InvoiceStatus } from "@/mocks/entities.types";
import { invoicesMock } from "@/mocks";
import { formatDateTime, formatMoney } from "./format";
import { DetailField, DetailGrid, PersonLine, SectionHeading, SourceFooter } from "./shared";

const LINK_METHOD_BADGE: Record<PaymentLinkMethod, string> = {
  THREAD_CONTEXT: "bg-sky-500/15 text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
  RECONCILED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  MANUAL: "bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25",
};

const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  UNPAID: "bg-secondary text-secondary-foreground",
  PARTIALLY_PAID: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  OVERDUE: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25",
};

export function PaymentDetail({ payment }: { payment: Payment }) {
  const invoice = payment.invoiceId ? invoicesMock.find((i) => i.id === payment.invoiceId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold">{formatMoney(payment.amount)}</span>
        {payment.linkMethod && (
          <Badge className={LINK_METHOD_BADGE[payment.linkMethod]}>{payment.linkMethod.replace(/_/g, " ")}</Badge>
        )}
      </div>

      <DetailGrid>
        <DetailField label="Paid At">{formatDateTime(payment.paidAt)}</DetailField>
        <DetailField label="Payer"><PersonLine person={payment.payer} /></DetailField>
        <DetailField label="Payee"><PersonLine person={payment.payee} /></DetailField>
      </DetailGrid>

      <div className="space-y-3">
        <SectionHeading>Linked Invoice</SectionHeading>
        {invoice ? (
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <div className="font-medium">{invoice.invoiceNumber ?? formatMoney(invoice.amount)}</div>
              <div className="text-xs text-muted-foreground"><PersonLine person={invoice.issuer} /></div>
            </div>
            <Badge className={INVOICE_STATUS_BADGE[invoice.status]}>{invoice.status.replace(/_/g, " ")}</Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not linked to any invoice — insufficient evidence to reconcile.</p>
        )}
      </div>

      <SourceFooter sourceUrl={payment.sourceUrl} createdAt={payment.createdAt} updatedAt={payment.updatedAt} />
    </div>
  );
}
