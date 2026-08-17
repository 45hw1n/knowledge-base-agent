import { AttachmentErrorCode } from "./types";

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export const ALLOWED_ATTACHMENT_FILE_PICKER_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.pdf";

export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_ENTITY = 3;

export const ATTACHMENT_ERROR_MESSAGES: Record<AttachmentErrorCode, string> = {
  FILE_TOO_LARGE: "Exceeds the 10MB size limit",
  UNSUPPORTED_FILE_TYPE: "Unsupported file type",
  UPLOAD_FAILED: "Upload failed",
  ATTACHMENT_LIMIT_EXCEEDED: "Attachment limit reached",
};
