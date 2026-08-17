import { useMemo } from "react";
import { AttachmentGroup } from "@/components/AttachmentGroup";
import { Attachment, AttachmentItem } from "@/features/attachments/types";
import { Button } from "@/lib/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/ui/popover";

interface TransactionAttachmentsCellProps {
  transactionId: string;
  attachments: Attachment[];
}

export function TransactionAttachmentsCell({
  transactionId,
  attachments,
}: TransactionAttachmentsCellProps) {
  const items = useMemo<AttachmentItem[]>(
    () =>
      attachments.map((attachment) => ({
        localId: attachment.id,
        attachmentId: attachment.id,
        file: null,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        status: "SUCCESS",
        errorCode: null,
      })),
    [attachments],
  );

  if (attachments.length === 0) return "—";

  const label = `📎 ${attachments.length} ${
    attachments.length === 1 ? "Attachment" : "Attachments"
  }`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-1.5 py-1 text-xs font-normal"
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <AttachmentGroup
          items={items}
          entityType="TRANSACTION"
          entityId={transactionId}
        />
      </PopoverContent>
    </Popover>
  );
}
