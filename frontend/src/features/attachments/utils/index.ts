import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
} from "../constants";
import type { Attachment, AttachmentItem } from "../types";

export interface AttachmentFileValidationResult {
  validFiles: File[];
  errors: string[];
}

/**
 * Client-side mirror of the backend's file rules (attachmentValidation.js) —
 * purely for immediate UX feedback. The backend re-validates everything, so
 * this never needs to be perfectly in sync to stay safe.
 */
export function validateAttachmentFiles(
  files: File[],
  { remainingSlots }: { remainingSlots: number },
): AttachmentFileValidationResult {
  const errors: string[] = [];

  if (remainingSlots <= 0) {
    errors.push("You already have the maximum number of attachments.");
    return { validFiles: [], errors };
  }

  if (files.length > remainingSlots) {
    errors.push(
      `You can only add ${remainingSlots} more attachment${
        remainingSlots === 1 ? "" : "s"
      }.`,
    );
  }

  const validFiles: File[] = [];

  files.slice(0, remainingSlots).forEach((file) => {
    if (
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
      )
    ) {
      errors.push(`"${file.name}" is not a supported file type.`);
      return;
    }

    if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      errors.push(`"${file.name}" exceeds the 10MB size limit.`);
      return;
    }

    validFiles.push(file);
  });

  return { validFiles, errors };
}

export function formatAttachmentFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toAttachmentItems(
  attachments: Attachment[],
): AttachmentItem[] {
  return attachments.map((attachment) => ({
    localId: attachment.id,
    attachmentId: attachment.id,
    file: null,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    status: "SUCCESS",
    errorCode: null,
  }));
}
