import { KeyboardEvent, MouseEvent } from "react";
import { Paperclip, Image as ImageIcon, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { cn } from "@/lib/utils";
import { AttachmentItemStatus } from "@/features/attachments/types";
import { formatAttachmentFileSize } from "@/features/attachments/utils";

export interface AttachmentCardProps {
  fileName: string;
  size: number;
  mimeType: string;
  status: AttachmentItemStatus;
  errorMessage?: string;
  onSelect?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Pure presentational row for a single attachment. No GraphQL calls, no
 * upload logic — everything happens through the callback props.
 */
export function AttachmentCard({
  fileName,
  size,
  mimeType,
  status,
  errorMessage,
  onSelect,
  onRemove,
  onRetry,
  onDismiss,
}: AttachmentCardProps) {
  const isImage = mimeType.startsWith("image/");
  const isSelectable = status === "SUCCESS" && Boolean(onSelect);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isSelectable || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSelect?.();
  };

  const stopPropagation = (callback: () => void) => (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    callback();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm",
        status === "FAILED"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border/60 bg-muted",
        isSelectable &&
          "cursor-pointer transition-colors hover:border-border hover:bg-muted-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={isSelectable ? onSelect : undefined}
      onKeyDown={handleKeyDown}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      aria-label={isSelectable ? `View ${fileName}` : undefined}
    >
      <div className="shrink-0 text-muted-foreground">
        {status === "UPLOADING" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isImage ? (
          <ImageIcon className="w-4 h-4" />
        ) : (
          <Paperclip className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate font-medium leading-5">{fileName}</p>
        {status === "FAILED" && errorMessage ? (
          <p className="text-xs text-destructive leading-4">{errorMessage}</p>
        ) : (
          <p className="text-xs text-muted-foreground leading-4">
            {formatAttachmentFileSize(size)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {status === "FAILED" && onRetry && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={stopPropagation(onRetry)}
            aria-label={`Retry uploading ${fileName}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
        {status === "SUCCESS" && onRemove && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={stopPropagation(onRemove)}
            aria-label={`Remove ${fileName}`}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
        {status === "FAILED" && onDismiss && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={stopPropagation(onDismiss)}
            aria-label={`Dismiss ${fileName}`}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
