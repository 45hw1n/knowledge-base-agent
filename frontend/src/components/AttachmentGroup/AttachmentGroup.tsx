import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AttachmentEntityType,
  AttachmentItem,
} from "@/features/attachments/types";
import { ATTACHMENT_ERROR_MESSAGES } from "@/features/attachments/constants";
import { useAttachmentDownload } from "@/features/attachments/hooks/useAttachmentDownload";
import {
  AttachmentGallery,
  GalleryAttachment,
} from "@/components/AttachmentGallery";
import { AttachmentCard } from "./AttachmentCard";

export interface AttachmentGroupProps {
  items: AttachmentItem[];
  entityType?: AttachmentEntityType;
  entityId?: string;
  onRemove?: (attachmentId: string) => void;
  onRetry?: (localId: string) => void;
  onDismissFailed?: (localId: string) => void;
}

/**
 * Renders the attachment list and owns launching the shared gallery. Upload,
 * remove, retry, preview URL, and download behaviour remain outside the cards.
 */
export function AttachmentGroup({
  items,
  entityType,
  entityId,
  onRemove,
  onRetry,
  onDismissFailed,
}: AttachmentGroupProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [initialAttachmentIndex, setInitialAttachmentIndex] = useState(0);
  const { getDownloadUrl, downloadAttachment } = useAttachmentDownload();

  const localUrls = useMemo(
    () =>
      new Map(
        items.flatMap((item) =>
          item.file
            ? [[item.localId, URL.createObjectURL(item.file)] as const]
            : [],
        ),
      ),
    [items],
  );

  useEffect(
    () => () => {
      localUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    [localUrls],
  );

  const galleryAttachments = useMemo<GalleryAttachment[]>(
    () =>
      items.flatMap((item) =>
        item.status === "SUCCESS" && (item.attachmentId || item.file)
          ? [
              {
                id: item.attachmentId ?? item.localId,
                fileName: item.fileName,
                mimeType: item.mimeType,
                size: item.size,
                localUrl: localUrls.get(item.localId),
              },
            ]
          : [],
      ),
    [items, localUrls],
  );

  const openGallery = (attachmentId: string) => {
    const selectedIndex = galleryAttachments.findIndex(
      (attachment) => attachment.id === attachmentId,
    );
    if (selectedIndex < 0) return;

    setInitialAttachmentIndex(selectedIndex);
    setGalleryOpen(true);
  };

  const resolveAttachmentUrl = useCallback(
    (attachment: GalleryAttachment) => {
      if (attachment.localUrl) {
        return Promise.resolve(attachment.localUrl);
      }
      if (!entityType || !entityId) {
        return Promise.reject(new Error("Attachment owner is unavailable"));
      }
      return getDownloadUrl({
        entityType,
        entityId,
        attachmentId: attachment.id,
      });
    },
    [entityId, entityType, getDownloadUrl],
  );

  const handleDownload = useCallback(
    (attachment: GalleryAttachment) => {
      if (attachment.localUrl) {
        const link = document.createElement("a");
        link.href = attachment.localUrl;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      if (!entityType || !entityId) return;
      void downloadAttachment(
        {
          entityType,
          entityId,
          attachmentId: attachment.id,
        },
        attachment.fileName,
      );
    },
    [downloadAttachment, entityId, entityType],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <AttachmentCard
            key={item.localId}
            fileName={item.fileName}
            size={item.size}
            mimeType={item.mimeType}
            status={item.status}
            errorMessage={
              item.errorCode ? ATTACHMENT_ERROR_MESSAGES[item.errorCode] : undefined
            }
            onSelect={
              (Boolean(item.file) ||
                Boolean(entityType && entityId && item.attachmentId)) &&
              item.status === "SUCCESS" &&
              (item.attachmentId || item.file)
                ? () => openGallery(item.attachmentId ?? item.localId)
                : undefined
            }
            onRemove={
              item.status === "SUCCESS" && onRemove
                ? () => onRemove(item.attachmentId ?? item.localId)
                : undefined
            }
            onRetry={
              item.status === "FAILED" && onRetry
                ? () => onRetry(item.localId)
                : undefined
            }
            onDismiss={
              item.status === "FAILED" && onDismissFailed
                ? () => onDismissFailed(item.localId)
                : undefined
            }
          />
        ))}
      </div>

      <AttachmentGallery
        open={galleryOpen}
        attachments={galleryAttachments}
        initialIndex={initialAttachmentIndex}
        onOpenChange={setGalleryOpen}
        getAttachmentUrl={resolveAttachmentUrl}
        onDownload={handleDownload}
      />
    </>
  );
}
