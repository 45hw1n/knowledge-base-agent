import { Paperclip } from "lucide-react";
import { Badge } from "@/lib/ui/badge";
import type { KnowledgeDocument } from "@/mocks/entities.types";
import { formatDate } from "./format";
import { DetailField, DetailGrid, SectionHeading } from "./shared";

// Prop named `doc`, not `document` — this project renames the type itself
// to KnowledgeDocument for the same reason: avoid shadowing the global DOM
// `document`.
export function DocumentDetail({ doc }: { doc: KnowledgeDocument }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{doc.type.replace(/_/g, " ")}</Badge>
      </div>

      {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}

      <DetailGrid>
        <DetailField label="Document Number">{doc.documentNumber ?? "—"}</DetailField>
        <DetailField label="Issuer">{doc.issuer?.name ?? "—"}</DetailField>
        <DetailField label="Effective Date">{formatDate(doc.effectiveDate)}</DetailField>
        <DetailField label="Expiry Date">{formatDate(doc.expiryDate)}</DetailField>
      </DetailGrid>

      {doc.parties.length > 0 && (
        <div className="space-y-3">
          <SectionHeading>Parties</SectionHeading>
          <ul className="space-y-1 text-sm">
            {doc.parties.map((party) => (
              <li key={party.name}>
                {party.name}
                {party.role && <span className="text-muted-foreground"> · {party.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeading>Summary</SectionHeading>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.summary}</p>
      </div>

      {doc.attachments.length > 0 && (
        <div className="space-y-3">
          <SectionHeading>Attachments</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {doc.attachments.map((attachment) => (
              <span
                key={attachment.attachmentId}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground"
              >
                <Paperclip className="h-3 w-3" />
                {attachment.fileName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
