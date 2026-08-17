import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/lib/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/lib/ui/dialog";

export interface GalleryAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  localUrl?: string;
}

export interface AttachmentGalleryProps {
  open: boolean;
  attachments: GalleryAttachment[];
  initialIndex: number;
  onOpenChange: (open: boolean) => void;
  getAttachmentUrl: (attachment: GalleryAttachment) => Promise<string>;
  onDownload: (attachment: GalleryAttachment) => void;
}

export function AttachmentGallery({
  open,
  attachments,
  initialIndex,
  onOpenChange,
  getAttachmentUrl,
  onDownload,
}: AttachmentGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const attachment = attachments[selectedIndex];
  const hasMultipleAttachments = attachments.length > 1;
  const isImage = attachment?.mimeType.startsWith("image/") ?? false;

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(Math.min(Math.max(initialIndex, 0), attachments.length - 1));
  }, [open, initialIndex, attachments.length]);

  useEffect(() => {
    let cancelled = false;

    setPreviewUrl(null);
    setPreviewFailed(false);

    if (!open || !attachment || !isImage) {
      setIsPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsPreviewLoading(true);
    getAttachmentUrl(attachment)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attachment, getAttachmentUrl, isImage, open]);

  const showPrevious = useCallback(() => {
    setSelectedIndex(
      (current) => (current - 1 + attachments.length) % attachments.length,
    );
  }, [attachments.length]);

  const showNext = useCallback(() => {
    setSelectedIndex((current) => (current + 1) % attachments.length);
  }, [attachments.length]);

  useEffect(() => {
    if (!open || !hasMultipleAttachments) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMultipleAttachments, open, showNext, showPrevious]);

  if (!attachment) return null;

  const renderDownloadView = () => (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-5 text-muted-foreground">
        <FileText className="h-10 w-10" />
      </div>
      <div className="max-w-md">
        <p className="break-words font-medium">{attachment.fileName}</p>
        {previewFailed && (
          <p className="mt-1 text-sm text-muted-foreground">
            This image could not be previewed.
          </p>
        )}
      </div>
      <Button onClick={() => onDownload(attachment)}>
        <Download />
        Download
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-[96rem] flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6">
          <DialogTitle className="min-w-0 truncate text-base">
            {attachment.fileName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Attachment preview
          </DialogDescription>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload(attachment)}
              aria-label={`Download ${attachment.fileName}`}
            >
              <Download />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close attachment gallery"
            >
              <X />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-6 sm:p-10">
          {isImage && !previewFailed ? (
            isPreviewLoading || !previewUrl ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <img
                src={previewUrl}
                alt={attachment.fileName}
                className="block max-h-full max-w-full object-contain"
                onError={() => setPreviewFailed(true)}
              />
            )
          ) : (
            renderDownloadView()
          )}

          {hasMultipleAttachments && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full shadow-md sm:left-5"
                onClick={showPrevious}
                aria-label="Previous attachment"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full shadow-md sm:right-5"
                onClick={showNext}
                aria-label="Next attachment"
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
