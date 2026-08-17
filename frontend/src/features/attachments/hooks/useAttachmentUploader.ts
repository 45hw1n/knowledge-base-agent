import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { UPLOAD_ATTACHMENTS, DELETE_ATTACHMENT } from "../api";
import {
  Attachment,
  AttachmentEntityType,
  AttachmentItem,
  UploadAttachmentsPayload,
} from "../types";
import { toAttachmentItems, validateAttachmentFiles } from "../utils";

interface UseAttachmentUploaderOptions {
  entityType: AttachmentEntityType;
  entityId: string;
  maxAttachments: number;
  initialAttachments?: Attachment[];
  onUploadSuccess?: (attachments: Attachment[]) => void;
}

let localIdSeq = 0;
function nextLocalId(): string {
  localIdSeq += 1;
  return `local-${Date.now()}-${localIdSeq}`;
}

/**
 * Owns ALL attachment upload behaviour for a single entity. The backend
 * owns the entire upload workflow (validate, upload to R2, persist
 * metadata) behind a single uploadAttachments() call — this hook only
 * ever needs to: validate files client-side, call that mutation, track a
 * single AttachmentItem[] collection (UPLOADING/SUCCESS/FAILED), retry
 * individual failed files, and delete attachments.
 *
 * Note on refresh behaviour: the Review Queue's CarouselList fetches via a
 * plain client.query() into a zustand store (not a reactive useQuery), so
 * updating Apollo's normalized cache wouldn't affect what's on screen. This
 * hook instead keeps its own local `items` state (seeded from the entity's
 * current data) and updates it directly — no Review Queue refetch needed.
 */
export function useAttachmentUploader({
  entityType,
  entityId,
  maxAttachments,
  initialAttachments = [],
  onUploadSuccess,
}: UseAttachmentUploaderOptions) {
  const [items, setItems] = useState<AttachmentItem[]>(() => toAttachmentItems(initialAttachments));

  // Re-sync when a different entity is shown (e.g. a different review card).
  useEffect(() => {
    setItems(toAttachmentItems(initialAttachments));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const [uploadAttachmentsMutation] = useMutation(UPLOAD_ATTACHMENTS);
  const [deleteAttachmentMutation] = useMutation(DELETE_ATTACHMENT);

  const uploadFiles = useCallback(
    async (files: File[], localIds: string[]) => {
      try {
        const { data } = await uploadAttachmentsMutation({
          variables: { input: { entityType, entityId, files } },
        });

        const payload: UploadAttachmentsPayload | undefined = data?.uploadAttachments;
        const results = payload?.files ?? [];
        const uploadedAttachments = payload?.attachments ?? [];

        setItems((prev) =>
          prev.map((item) => {
            const index = localIds.indexOf(item.localId);
            if (index === -1) return item;

            const result = results[index];
            if (!result) {
              return { ...item, status: "FAILED", errorCode: "UPLOAD_FAILED" };
            }

            if (result.status === "SUCCESS") {
              return {
                ...item,
                attachmentId: result.attachmentId,
                status: "SUCCESS",
                file: null,
                errorCode: null,
              };
            }

            return {
              ...item,
              attachmentId: result.attachmentId,
              status: "FAILED",
              errorCode: result.errorCode ?? "UPLOAD_FAILED",
            };
          }),
        );

        const failedCount = results.filter((result) => result.status === "FAILED").length;
        if (failedCount > 0) {
          toast.error(
            failedCount === 1
              ? `Failed to upload "${results.find((r) => r.status === "FAILED")?.fileName}"`
              : `Failed to upload ${failedCount} files`,
          );
        }
        if (uploadedAttachments.length > 0) {
          onUploadSuccess?.(uploadedAttachments);
        }
      } catch (error) {
        setItems((prev) =>
          prev.map((item) =>
            localIds.includes(item.localId)
              ? { ...item, status: "FAILED", errorCode: "UPLOAD_FAILED" }
              : item,
          ),
        );
        toast.error(error instanceof Error ? error.message : "Failed to upload attachment(s)");
      }
    },
    [entityId, entityType, onUploadSuccess, uploadAttachmentsMutation],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (!files || files.length === 0) return;

      const remainingSlots = Math.max(
        maxAttachments - items.filter((item) => item.status !== "FAILED").length,
        0,
      );
      const { validFiles, errors } = validateAttachmentFiles(files, { remainingSlots });

      errors.forEach((message) => toast.error(message));
      if (validFiles.length === 0) return;

      const localIds = validFiles.map(() => nextLocalId());

      setItems((prev) => [
        ...prev,
        ...validFiles.map((file, index) => ({
          localId: localIds[index],
          attachmentId: null,
          file,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          status: "UPLOADING" as const,
          errorCode: null,
        })),
      ]);

      void uploadFiles(validFiles, localIds);
    },
    [items, maxAttachments, uploadFiles],
  );

  const retry = useCallback(
    (localId: string) => {
      const item = items.find((candidate) => candidate.localId === localId);
      if (!item || !item.file) return;

      setItems((prev) =>
        prev.map((candidate) =>
          candidate.localId === localId
            ? { ...candidate, status: "UPLOADING", errorCode: null }
            : candidate,
        ),
      );
      void uploadFiles([item.file], [localId]);
    },
    [items, uploadFiles],
  );

  const remove = useCallback(
    async (attachmentId: string) => {
      try {
        await deleteAttachmentMutation({
          variables: { input: { entityType, entityId, attachmentId } },
        });
        setItems((prev) => prev.filter((item) => item.attachmentId !== attachmentId));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to remove attachment");
      }
    },
    [deleteAttachmentMutation, entityId, entityType],
  );

  const dismissFailed = useCallback((localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
  }, []);

  const removeItemsLocally = useCallback((attachmentIds: string[]) => {
    const idSet = new Set(attachmentIds);
    setItems((prev) =>
      prev.filter(
        (item) => !item.attachmentId || !idSet.has(item.attachmentId),
      ),
    );
  }, []);

  return {
    items,
    addFiles,
    retry,
    remove,
    removeItemsLocally,
    dismissFailed,
  };
}
