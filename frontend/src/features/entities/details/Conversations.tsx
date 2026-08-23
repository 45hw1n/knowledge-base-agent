import { Fragment } from "react";
import { Avatar, AvatarFallback } from "@/lib/ui/avatar";
import { cn } from "@/lib/utils";
import config from "@/lib/config";
import { AttachmentCard } from "@/components/AttachmentGroup/AttachmentCard";
import type { AttachmentRef, ConversationDirection, ConversationMessage, Person } from "@/mocks/entities.types";
import { formatDateTime } from "./format";

// Matches a bare URL or email address inside plain-text conversation
// content, purely for auto-linking on render — never HTML, never
// dangerouslySetInnerHTML. Content itself stays plain text (see
// decisions.md — rich text here is a display concern, not a stored one).
const URL_OR_EMAIL_REGEX = /(\bhttps?:\/\/[^\s<]+[^\s<.,:;!?'")\]]|\b[\w.+-]+@[\w-]+\.[\w.-]+\b)/g;

function linkify(text: string, keyPrefix: string) {
  return text.split(URL_OR_EMAIL_REGEX).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={key} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {part}
        </a>
      );
    }
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(part)) {
      return (
        <a key={key} href={`mailto:${part}`} className="underline underline-offset-2">
          {part}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function RichContent({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const toRender = paragraphs.length > 0 ? paragraphs : [content];

  return (
    <div className="conversation-content space-y-2 text-sm leading-relaxed">
      {toRender.map((paragraph, pIdx) => {
        const lines = paragraph.split("\n");
        return (
          <p key={pIdx}>
            {lines.map((line, lIdx) => (
              <Fragment key={lIdx}>
                {linkify(line, `${pIdx}-${lIdx}`)}
                {lIdx < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function getInitials(sender: Person | null): string {
  const name = sender?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (sender?.email) return sender.email[0]?.toUpperCase() ?? "?";
  return "?";
}

function getDisplayName(sender: Person | null, direction: ConversationDirection): string {
  if (sender?.name) return sender.name;
  if (sender?.email) return sender.email;
  return direction === "SENT" ? "You" : "Unknown sender";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentBadge({ messageId, attachment }: { messageId: string; attachment: AttachmentRef }) {
  // A manual "Create Knowledge" attachment's attachmentId is an R2 storage
  // key (`users/{userId}/manual-ingestion/...`), not a Gmail attachmentId —
  // route those through the signed-URL redirect instead of the Gmail-only
  // live proxy. See backend/src/routes/attachmentRoutes.js.
  const href = attachment.attachmentId.startsWith("users/")
    ? `${config.apiUrl}/api/attachments/manual?key=${encodeURIComponent(attachment.attachmentId)}`
    : `${config.apiUrl}/api/attachments/gmail/${encodeURIComponent(messageId)}/${encodeURIComponent(attachment.attachmentId)}`;

  return (
    <AttachmentCard
      fileName={attachment.fileName}
      size={attachment.size ?? 0}
      mimeType={attachment.mimeType ?? "application/octet-stream"}
      status="SUCCESS"
      onSelect={() => window.open(href, "_blank", "noopener,noreferrer")}
    />
  );
}

function ConversationMessageBubble({ message }: { message: ConversationMessage }) {
  const isReceived = message.direction === "RECEIVED";

  return (
    <div className={cn("flex", isReceived ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] min-w-0 rounded-lg border p-3",
          isReceived ? "bg-muted/40" : "bg-primary/5"
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{getInitials(message.sender)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{getDisplayName(message.sender, message.direction)}</span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(message.timestamp)}</span>
        </div>

        <RichContent content={message.content} />

        {message.attachments.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {message.attachments.map((attachment) => (
              <AttachmentBadge key={attachment.attachmentId} messageId={message.messageId} attachment={attachment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders a Ticket/Invoice's conversation[] inside the entity detail modal.
 * RECEIVED messages align left, SENT messages align right, each with a
 * distinct background — the usual chat convention.
 */
export function Conversations({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No conversation captured.</p>;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <ConversationMessageBubble key={message.messageId} message={message} />
      ))}
    </div>
  );
}
