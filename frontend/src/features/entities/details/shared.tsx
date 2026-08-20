import { ExternalLink, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationMessage, Person } from "@/mocks/entities.types";
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

// Shared by Ticket/Invoice/Payment detail views — all three carry the same
// ConversationMessage[] shape (see entities.types.ts).
export function ConversationThread({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No conversation captured.</p>;
  }
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div
          key={message.messageId}
          className={cn(
            "rounded-lg border p-3 text-sm",
            message.direction === "SENT" ? "ml-6 bg-primary/5" : "mr-6 bg-muted/40"
          )}
        >
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{message.direction === "SENT" ? "Sent" : "Received"}</span>
            <span>{formatDateTime(message.timestamp)}</span>
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((attachment) => (
                <span
                  key={attachment.attachmentId}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground"
                >
                  <Paperclip className="h-3 w-3" />
                  {attachment.fileName}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Shared footer across all five detail views — every typed record carries
// the same source/timestamp provenance fields.
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
    <div className="mt-6 flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
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
