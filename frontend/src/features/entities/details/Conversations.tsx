import { Fragment } from "react";
import { Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/lib/ui/avatar";
import { cn } from "@/lib/utils";
import config from "@/lib/config";
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentBadge({ messageId, attachment }: { messageId: string; attachment: AttachmentRef }) {
  // Never stored by Cortex — this hits a live proxy that fetches the bytes
  // from Gmail on demand, on every click. See backend/src/routes/attachmentRoutes.js.
  const href = `${config.apiUrl}/api/attachments/gmail/${encodeURIComponent(messageId)}/${encodeURIComponent(attachment.attachmentId)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60"
    >
      <Paperclip className="h-3 w-3" />
      {attachment.fileName}
      {attachment.size != null && <span className="text-muted-foreground/70">· {formatBytes(attachment.size)}</span>}
    </a>
  );
}

function ConversationMessageBubble({ message }: { message: ConversationMessage }) {
  const isReceived = message.direction === "RECEIVED";

  return (
    <div className={cn("flex", isReceived ? "justify-end" : "justify-start")}>
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
          <div className="mt-2 flex flex-wrap gap-2">
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
 * RECEIVED messages align right, SENT messages align left, each with a
 * distinct background — per the requested layout (the reverse of the usual
 * chat convention, deliberate per spec).
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
